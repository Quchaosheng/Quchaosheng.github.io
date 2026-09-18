---
title: perf 采样入门：从 perf record 到火焰图，先分清 on-CPU 和 off-CPU
date: 2026-09-11 09:30:00
permalink: /2026/09/11/perf-record-offcpu-flamegraph/
categories: [技术, 调试]
tags: [perf, 火焰图, 性能分析, 采样]
---

程序跑得慢时，最容易得到的结论是“某个函数耗时长”。但耗时有两种来源：线程真正在 CPU 上执行，或者线程在等待别的东西让出 CPU。前者用 on-CPU 采样能看到，后者需要 off-CPU 分析。把两者混在一起看，结论经常是错的。

这篇文章按“先确认时间花在 CPU 上还是等待上”的顺序展开，因为这决定了下一步该用哪类工具。

<div class="note-flow"><span>确定慢的进程</span><i>→</i><span>采样 on-CPU 火焰图</span><i>→</i><span>判断等待是否占主导</span><i>→</i><span>必要时做 off-CPU 分析</span><i>→</i><span>定位具体阻塞点</span><i>→</i><span>修改后重新采样对比</span></div>

<figure class="note-visual"><figcaption><span>两类时间</span>火焰图的宽度代表采样占比，不包含线程睡眠的时间。</figcaption><div class="note-map"><span><b>on-CPU</b><small>线程在处理器上执行时的调用栈采样。</small></span><span><b>off-CPU</b><small>线程被阻塞等待时的栈，例如锁、IO、休眠。</small></span><span><b>采样频率</b><small>决定了时间分辨率，也决定了开销上限。</small></span><span><b>调用栈</b><small>没有栈数据时只能看到函数本身，无法归因。</small></span><span><b>火焰图</b><small>把大量采样按调用关系聚合成可读的形状。</small></span><span><b>符号</b><small>缺少调试信息时栈会退化成地址。</small></span></div></figure>

## 先做一个基本采样

```bash
perf record -F 99 -g -p <pid> -- sleep 30
perf report --stdio | head -40
```

`-F 99` 是采样频率，`-g` 表示记录调用栈，`-p` 指定进程。频率越高细节越多，开销也越大。先做一个可接受开销的采样，看是否存在明显热点。

如果输出里大量出现地址而不是函数名，说明符号信息不足。常见原因是二进制被剥离、使用了优化构建且没有调试信息，或者采样的是 JIT 代码。补上符号是继续分析的前提，否则后面所有结论都不可靠。

## 生成火焰图

火焰图把采样按调用关系聚合，宽条代表占比高的路径：

```bash
perf script > out.perf
./FlameGraph/stackcollapse-perf.pl out.perf > out.folded
./FlameGraph/flamegraph.pl out.folded > flame.svg
```

读图时有两点容易误判。第一，宽度是整个栈出现的比例，不是单个函数的独占时间，需要沿调用链看有多少是被上层带进来的。第二，火焰图只覆盖被采样的时间，如果线程大部分时间在睡眠，图上看起来会很“瘦”，但这不代表程序不慢。

## 判断是否需要 off-CPU 分析

一个实用信号是：程序实际耗时远大于火焰图覆盖的时间，而且线程处于可中断睡眠或等待状态。

```bash
# 观察线程状态分布
pidstat -p <pid> 1 5
cat /proc/<pid>/status | grep -E "State|voluntary"
```

如果线程大量时间处于 `S` 或 `D` 状态，热点函数可能不是原因，等待才是。这时需要观察阻塞点，例如通过内核追踪点统计调度延迟与唤醒来源，而不是继续加大采样频率。

off-CPU 分析的数据来源和 on-CPU 不同，往往需要内核追踪设施配合，并且采样对象是“等待事件”而不是“执行时刻”。把它和 on-CPU 火焰图放在同一张图里比较，会得到误导性结论。

## 采样只是证据的一半

采样给出的是统计分布，不直接给出因果。两个函数在图上并排出现，只说明它们被采到的次数多，不说明前者导致了后者变慢。

要把结论变成可验证的假设，通常需要进一步实验：把可疑参数固定下来，只改变一个变量，重新采样对比。两次采样之间应该记录负载、线程数、输入和构建版本，否则差异可能来自环境变化。

## 参考资料

- [perf 手册页](https://man7.org/linux/man-pages/man1/perf.1.html)
- [perf record 手册页](https://man7.org/linux/man-pages/man1/perf-record.1.html)
- [FlameGraph 工具集](https://github.com/brendangregg/FlameGraph)
- [perf 安全与权限说明](https://docs.kernel.org/admin-guide/perf-security.html)

## 证据边界

本文讨论采样流程与解读方式，不包含任何具体程序的性能数字。火焰图的形状和热点取决于输入负载、构建选项和运行环境；没有符号或没有对照实验时，采样结果不足以支撑“某函数是瓶颈”的结论。
