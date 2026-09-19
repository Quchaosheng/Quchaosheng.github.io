---
title: perf 采样入门：从 perf record 到火焰图，先分清 on-CPU 和 off-CPU
date: 2026-09-11 09:30:00
permalink: /2026/09/11/perf-record-offcpu-flamegraph/
categories: [技术, 调试]
tags: [perf, 火焰图, 性能分析, 采样]
---

第一次用火焰图的时候我犯过一个错：抓了 30 秒，图看起来很“瘦”，几乎没有热点，于是断定程序没问题。实际上那个程序大部分时间在等锁，根本不在 CPU 上跑。

火焰图只画 on-CPU 的部分。线程睡着的时候不会被采到，所以“图很干净”和“程序很快”是两件毫不相干的事。

<div class="note-flow"><span>确定慢的进程</span><i>→</i><span>采 on-CPU 火焰图</span><i>→</i><span>看等待是不是主导</span><i>→</i><span>必要时做 off-CPU 分析</span><i>→</i><span>定位阻塞点</span><i>→</i><span>改完重新采样对比</span></div>

<figure class="note-visual"><figcaption><span>两类时间</span>火焰图的宽度是采样占比，里面不含线程睡眠的时间。</figcaption><div class="note-map"><span><b>on-CPU</b><small>线程在处理器上执行时的调用栈采样。</small></span><span><b>off-CPU</b><small>被阻塞时的栈，比如锁、IO、休眠。</small></span><span><b>采样频率</b><small>决定时间分辨率，也决定开销上限。</small></span><span><b>调用栈</b><small>没有栈就只能看到函数本身，无法归因。</small></span><span><b>火焰图</b><small>把大量采样按调用关系聚合。</small></span><span><b>符号</b><small>缺调试信息时栈会退化成地址。</small></span></div></figure>

## 先做一次基本采样

```bash
perf record -F 99 -g -p <pid> -- sleep 30
perf report --stdio | head -40
```

`-F 99` 是频率，`-g` 记调用栈，`-p` 指定进程。频率越高细节越多，开销也越大，先挑一个能接受的值。

输出里如果大量出现地址而不是函数名，说明符号缺失。常见原因是二进制被 strip 过、用了优化构建但没带调试信息，或者采的是 JIT 代码。先把符号补上，不然后面所有结论都不靠谱。

## 生成火焰图

```bash
perf script > out.perf
./FlameGraph/stackcollapse-perf.pl out.perf > out.folded
./FlameGraph/flamegraph.pl out.folded > flame.svg
```

读图有两个坑。宽度是整个栈出现的比例，不是单个函数的独占时间，得沿着调用链看有多少是被上层带进来的。另外它只覆盖被采到的时间，线程大多在睡眠时图会很瘦，但这不代表程序不慢。

## 什么时候该换 off-CPU

一个实用信号：实际耗时远大于火焰图覆盖的时间，而且线程在可中断睡眠里。

```bash
pidstat -p <pid> 1 5
cat /proc/<pid>/status | grep -E "State|voluntary"
```

线程大量时间处于 `S` 或 `D`，那热点函数多半不是原因，等待才是。这时候该去看阻塞点，比如用内核追踪点统计调度延迟和唤醒来源，而不是继续加采样频率。

off-CPU 的数据来源和 on-CPU 不一样，通常要内核追踪设施配合，采的是“等待事件”而不是“执行时刻”。把它和 on-CPU 火焰图画在同一张图里比较，得到的结论基本是误导的。

## 采样只是证据的一半

采样给的是统计分布，不是因果。两个函数在图上并排出现，只说明它们被采到的次数多，不说明后者是被前者拖慢的。

要把结论变成可验证的假设，通常还得做实验：固定可疑参数，只改一个变量，重新采样对比。两次采样之间记录负载、线程数、输入和构建版本，不然差异可能来自环境变化。

## 参考资料

- [perf 手册页](https://man7.org/linux/man-pages/man1/perf.1.html)
- [perf record 手册页](https://man7.org/linux/man-pages/man1/perf-record.1.html)
- [FlameGraph 工具集](https://github.com/brendangregg/FlameGraph)
- [perf 安全与权限说明](https://docs.kernel.org/admin-guide/perf-security.html)

**证据边界：**本文不含任何具体程序的性能数字。火焰图的形状和热点取决于输入负载、构建选项和运行环境；没有符号或者没有对照实验时，采样结果撑不起“某函数是瓶颈”这种结论。
