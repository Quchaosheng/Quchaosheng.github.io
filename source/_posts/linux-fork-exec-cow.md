---
title: fork、exec 与 COW：进程是怎样创建的
date: 2026-07-29 16:09:18
source_checked_at: 2026-07-29 16:09:18
permalink: /2026/07/29/linux-fork-exec-cow/
categories: [技术, Linux内核]
tags: [fork, exec, COW, 进程]
description: 串起 fork、写时复制、文件描述符继承与 execve，说明多线程程序创建子进程时容易忽略的边界。
---

Shell 启动外部命令时，常见路径是先 `fork()` 得到子进程，再由子进程 `execve()` 新程序。Linux 不会在 fork 当场复制父进程的全部用户内存，而是复制必要的进程元数据和页表关系，让父子暂时共享物理页。只有某一方写入共享私有页时，才触发写时复制（COW）。

## fork 实际复制与共享什么

子进程得到独立的虚拟地址空间视图、进程 ID 和调度实体，但许多内核对象以引用方式继承。文件描述符表中的条目引用相同的 open file description，因此父子可能共享文件偏移和状态标志。信号处理、定时器、锁和其他属性则按 POSIX 规则分别继承或重置，不能简单概括为“完整复制”。

<div class="note-flow"><span>父进程调用 fork</span><i>→</i><span>父子共享物理页</span><i>→</i><span>某一方尝试写入</span><i>→</i><span>COW 缺页异常</span><i>→</i><span>复制并建立私有页</span></div>

<div class="note-map"><span><b>task/mm 元数据</b><small>为子进程建立独立进程视图</small></span><span><b>私有映射</b><small>物理页先共享，写入时 COW</small></span><span><b>共享映射</b><small>MAP_SHARED 的修改仍对双方可见</small></span><span><b>文件描述符</b><small>引用同一 open file description</small></span><span><b>execve</b><small>替换地址空间，PID 通常不变</small></span><span><b>CLOEXEC</b><small>避免不需要的 fd 泄漏到新程序</small></span></div>

## execve 替换了什么

`execve()` 成功后，当前进程的代码、数据、堆、栈和内存映射被新程序替换，入口从新 ELF 的启动路径开始执行。PID 保持不变，但线程组中调用者之外的线程不会继续存在。设置了 `FD_CLOEXEC` 的文件描述符会关闭，其余描述符默认保留；这也是服务程序必须认真管理 close-on-exec 的原因。

```bash
strace -f -e trace=clone,fork,vfork,execve,wait4 \
  sh -c 'printf "%s\n" hello | wc -l'

# 查看当前 shell 打开的描述符及其目标
ls -l /proc/$$/fd
```

观察时可能看到 `clone()` 或 `clone3()` 而不是字面上的 `fork()`，因为 libc 可以通过更底层接口实现相同语义。`strace` 会显著改变时序，只适合确认系统调用关系，不适合直接测创建延迟。

## COW 何时仍然昂贵

fork 不复制全部物理页，但仍要建立子进程的页表和内核元数据。父进程地址空间很大时，这部分成本不可忽略；fork 后父子大量写内存还会触发许多 COW fault 和页面复制。只为了立即 exec 的程序，可以评估 `posix_spawn()`，但具体实现与收益取决于 libc 和调用选项。

## 多线程程序的危险窗口

多线程进程 fork 后，子进程只保留调用 fork 的线程，其他线程持有的用户态锁状态却可能被复制。子进程在 exec 前调用需要这些锁的复杂库函数，可能死锁。POSIX 对这个窗口允许调用的函数有严格限制，常见做法是尽快执行 exec，并使用 `pthread_atfork()` 处理确有必要的锁协议。

## 证据边界

本文讨论 Linux/POSIX 常见语义，不覆盖容器 namespace、seccomp、凭据变化和解释器脚本等全部 exec 细节。分析资源泄漏时应同时检查 fork 前后的描述符标志与 exec 失败分支。

参考：[fork(2)](https://man7.org/linux/man-pages/man2/fork.2.html) · [execve(2)](https://man7.org/linux/man-pages/man2/execve.2.html) · [posix_spawn(3)](https://man7.org/linux/man-pages/man3/posix_spawn.3.html) · [不懂进程 fork/exec 与 COW，别再说你懂 Linux 内核了](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494604&idx=1&sn=3d3ec9c1a922d624b7267b3690be0a6e)
