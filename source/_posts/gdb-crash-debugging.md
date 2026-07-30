---
title: GDB 崩溃调试：从信号到调用栈
date: 2026-04-13 14:00:00
source_checked_at: 2026-07-29 16:09:18
permalink: /2026/07/29/gdb-crash-debugging/
categories: [技术, 调试]
tags: [GDB, CoreDump, 崩溃分析]
description: 建立从 core 文件、构建产物和线程栈到内存证据的排查顺序，减少只盯崩溃行造成的误判。
---

程序收到 `SIGSEGV` 后停在 `memcpy()`，问题就一定出在这个函数吗？通常不是。越界写可能早已破坏对象，悬空指针也可能在很久以后才被解引用。GDB 崩溃分析真正要做的是保存现场，然后回答：哪个线程收到什么信号，调用路径是什么，关键对象何时开始不合理。

## 先保证 core 文件可用

分析前需要四样东西：core 文件、产生它的可执行文件、完全匹配的共享库，以及调试符号。重新编译一个“差不多”的二进制通常不够，因为地址布局、优化和源码行都可能变化。

<div class="note-flow"><span>程序收到致命信号</span><i>→</i><span>系统保存 core 与元数据</span><i>→</i><span>加载匹配二进制和符号</span><i>→</i><span>确定异常线程</span><i>→</i><span>沿调用栈验证参数、对象与内存</span></div>

<div class="note-map"><span><b>core 文件</b><small>保存进程地址空间、寄存器和线程状态的快照</small></span><span><b>ELF 与 build ID</b><small>用来匹配当时运行的二进制和调试符号</small></span><span><b>致命信号</b><small>说明停止原因，但不总能指出破坏发生的位置</small></span><span><b>异常线程</b><small>当前触发故障的线程，可能不是最初写坏内存的线程</small></span><span><b>调用栈</b><small>从当前指令回溯调用关系，受优化与栈损坏影响</small></span><span><b>交叉证据</b><small>日志、输入、Sanitizer 和版本信息用于验证推断</small></span></div>

传统 core 可先这样开启：

```bash
ulimit -c unlimited
cat /proc/sys/kernel/core_pattern
./demo

# 传统 core 文件
gdb ./demo ./core

# systemd-coredump 管理的系统
coredumpctl list demo
coredumpctl info demo
coredumpctl debug demo
```

`core_pattern` 可能把 core 交给 systemd-coredump 或其他收集程序，因此当前目录没文件不等于没有生成。容器、服务单元的 `LimitCORE`、磁盘配额和安全策略也会改变结果。

## 进入 GDB 后按证据顺序看

```gdb
set pagination off
info files
info sharedlibrary
info threads
thread apply all bt full

thread 7
frame 0
info args
info locals
info registers
x/16gx pointer
p *object
```

先看 `info files` 和共享库是否匹配，再找带有致命信号的线程。对死锁或 watchdog 触发的 dump，真正有用的可能是另一个持锁线程，因此 `thread apply all bt full` 往往比只看当前线程更重要。

沿栈向上走时，每一帧只回答一个具体问题：传入的长度是否越界，指针是否指向已释放区域，对象字段是否违反状态机约束。看到一个异常值后，继续确认它来自函数参数、共享对象还是已经损坏的栈，别急着把最后赋值者当成根因。

## 优化构建会改变你看到的东西

`-g` 负责调试信息，`-O0` 才是关闭优化，两者不是同一个开关。生产二进制可以保留优化并单独保存调试符号；构建系统应记录 commit、编译器、flags 和 build ID。常用的折中设置是保留帧指针，但这会影响性能和 ABI 选择，应通过项目构建配置统一决定。

```bash
readelf -n ./demo | grep -A3 'Build ID'
file ./demo
gdb -batch -ex 'thread apply all bt full' ./demo ./core > backtrace.txt
```

如果 GDB 显示 `<optimized out>`、栈回溯突然断裂或多个源码行合并，不代表变量从未存在。编译器可能把变量留在寄存器、消除存储或内联函数。此时结合反汇编、寄存器和调用约定检查，必要时用同一输入在 ASan/UBSan 构建上复现。

## 什么时候 core 也不够

- 堆越界在数分钟后才触发崩溃，core 只留下最后受害者。
- 数据竞争依赖时序，离线快照看不到发生顺序。
- 栈或 unwind 信息已损坏，回溯结果不可信。
- 二进制、共享库或 debuginfo 不匹配，源码行只是错配结果。
- 进程被 `SIGKILL` 终止，通常没有用户态崩溃现场可供回溯。

这类问题需要更早的证据：Sanitizer、崩溃前环形日志、请求 ID、关键状态变更记录，或可控的复现输入。工具越靠近错误首次发生的位置，推断链越短。

## 证据边界

core 是某一时刻的快照，能证明寄存器、内存和线程当时是什么状态，不能单独证明哪一行最早破坏了它们。文中的命令适用于常见 Linux ELF 环境；转储范围、路径和隐私内容受 `core_pattern`、`coredump_filter`、systemd 配置及权限控制。core 可能包含密钥和用户数据，上传或长期保存前必须脱敏并限制访问。

参考：[Debugging with GDB](https://sourceware.org/gdb/current/onlinedocs/gdb.html/) · [core(5)](https://man7.org/linux/man-pages/man5/core.5.html) · [深入 GDB 调试原理，拆解程序崩溃内核](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494945&idx=1&sn=9dffabf351197d5418549c39e4ee7202)
