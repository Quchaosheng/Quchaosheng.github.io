---
title: Linux 内存泄漏排查：先分清是哪一种内存增长
date: 2026-04-23 10:00:00
source_checked_at: 2026-07-29 16:09:18
permalink: /2026/07/29/linux-memory-leak-diagnosis/
categories: [技术, 调试]
tags: [内存泄漏, RSS, Valgrind, Sanitizer]
description: 用 RSS、PSS、smaps、LeakSanitizer 和分配剖析拆解内存增长，区分真正泄漏、缓存和分配器滞留。
---

服务的 RSS 从 500 MiB 涨到 2 GiB，不足以证明发生了内存泄漏。它可能有不可达的堆对象，也可能只是缓存仍被业务持有、文件映射变多、线程栈增加、共享页计入方式变化，或分配器保留了空闲 arena 没有归还内核。第一步不是换工具，而是先给“增长”分类。

## 三层问题不要混在一起

应用层关心对象是否还可达、缓存是否有上限；分配器层关心 arena、碎片和线程缓存；内核层看到的是匿名页、文件页、共享页和 swap。三个层次的数字不会天然相等。

<div class="note-flow"><span>固定版本与负载复现增长</span><i>→</i><span>确认进程和增长区间</span><i>→</i><span>用 smaps 拆分映射类型</span><i>→</i><span>定位分配栈或持有者</span><i>→</i><span>修复后用同一负载验证平台期</span></div>

<div class="note-map"><span><b>VmSize</b><small>虚拟地址空间总量，大映射不等于都驻留物理内存</small></span><span><b>RSS</b><small>当前驻留页总量，共享页可能在多个进程重复统计</small></span><span><b>PSS</b><small>把共享页按映射进程分摊，适合估算进程实际份额</small></span><span><b>Anonymous</b><small>堆、匿名 mmap 和栈等匿名驻留页</small></span><span><b>Private_Dirty</b><small>进程私有且已写脏的页，常是堆增长的重要线索</small></span><span><b>可达对象</b><small>仍被引用但业务不再需要，泄漏检测器未必会报告</small></span></div>

先连续采样趋势，不要只保存一次 `top` 截图：

```bash
PID=1234
pidstat -r -p $PID 5
grep -E 'VmSize|VmRSS|RssAnon|RssFile|RssShmem|VmSwap|Threads' /proc/$PID/status
cat /proc/$PID/smaps_rollup
pmap -x $PID | tail -n 20
```

如果 `RssAnon` 持续增长，重点看堆、匿名 mmap、线程栈和 allocator；`RssFile` 增长更可能与文件映射、共享库或 page cache 映射有关；`RssShmem` 则应追踪 tmpfs、共享内存与相关进程。实际分类以 `smaps` 的每个 VMA 为准。

## 泄漏检测器能回答什么

能在测试环境稳定复现时，LeakSanitizer 通常是第一选择。它在进程退出时检查无法从根集合到达的分配：

```bash
clang -g -O1 -fno-omit-frame-pointer -fsanitize=address,leak demo.c -o demo
ASAN_OPTIONS=detect_leaks=1 ./demo

# 无法重新编译时，可用 Memcheck 做一次低速复现
valgrind --leak-check=full --show-leak-kinds=all --track-origins=yes ./demo
```

LSan 报告“direct leak”并不自动指出业务修复方式。需要沿分配栈找所有权为何丢失。相反，缓存表里仍有指针的对象在可达性上不是 leak，哪怕缓存没有淘汰策略、最终吃光内存。此时要采样对象数量、键空间和缓存命中，找到谁还在持有。

Valgrind 不要求插桩构建，但运行开销高，线程时序和性能可能与线上明显不同。两种工具都更适合可控输入，不能不加评估直接挂在生产进程上。

## 分配器滞留与碎片

对象已经 `free()`，RSS 仍可能不降。glibc 等分配器会把空闲块留在用户空间，供后续分配复用；多线程 arena、大小类别和不连续空洞也可能让部分页无法及时归还。这不一定是泄漏，但会形成真实的内存容量压力。

判断方法是同时观察业务对象数、累计分配量和 RSS。若活跃对象稳定、RSS 在预热后达到平台，可能是缓存或 allocator 稳态；若活跃对象持续增长，应追踪所有权；若对象下降但 RSS 长期保持高位，则进一步分析碎片、arena 和 `mmap` 分布。

```bash
# 按 Private_Dirty 排出 smaps 中值得继续看的映射需要额外解析
grep -E '^[0-9a-f].*|^(Size|Rss|Pss|Private_Dirty|Anonymous):' /proc/$PID/smaps > smaps.snapshot

# 比较两个时间点，而不是凭一次快照判断
cp /proc/$PID/smaps_rollup smaps_rollup.before
sleep 60
cp /proc/$PID/smaps_rollup smaps_rollup.after
diff -u smaps_rollup.before smaps_rollup.after
```

## 一套可复核的结论

修复报告至少要留下：输入负载、观察时长、版本、峰值与平台 RSS、关键映射变化、分配调用栈、活跃对象计数，以及修复前后同条件对比。只写“运行一晚没有再涨”很难排除负载不足或采样遗漏。

还要检查 OOM 日志和 cgroup 限制。进程可能没有传统泄漏，却因容器 `memory.max` 太小、共享页计费或突发缓存而被杀。系统内存充足也不能说明某个 cgroup 没有达到上限。

## 证据边界

本文面向用户态进程。内核 slab、页表、驱动 DMA 缓冲和 page cache 的系统级增长需要其他指标。`smaps` 是采样时刻的映射统计，读取本身也有成本；LSan 与 Valgrind 只覆盖它们能追踪到的分配和执行路径。任何“已修复”结论都应在相同版本、负载、时长与内存限制下复测。

参考：[proc_pid_smaps(5)](https://man7.org/linux/man-pages/man5/proc_pid_smaps.5.html) · [LeakSanitizer](https://clang.llvm.org/docs/LeakSanitizer.html) · [Valgrind Memcheck Manual](https://valgrind.org/docs/manual/mc-manual.html) · [Linux 如何查找内存泄漏和内存占用过大？](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247489493&idx=1&sn=30c6465407868a9aa55ad3e27234fc4c)
