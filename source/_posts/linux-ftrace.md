---
title: Ftrace：Linux 内核函数跟踪是怎样工作的
date: 2026-07-04 20:20:00
permalink: /2026/07/29/linux-ftrace/
categories: [技术, Linux内核]
tags: [Ftrace, tracefs, 可观测性]
---

当问题发生在内核路径里，普通日志常常太慢、太少或改变时序。Ftrace 是 Linux 内置的跟踪框架，可记录函数调用、调度、IRQ、软中断以及大量 tracepoint 事件。它依托 per-CPU ring buffer 收集数据，能够在较低侵入下回答“哪个 CPU 在什么时候做了什么”；但跟踪本身也会产生开销，所以最重要的技巧不是开更多事件，而是先缩小观察范围。

<div class="note-flow"><span>编译时预留函数入口</span><i>→</i><span>启用 tracer/事件</span><i>→</i><span>动态修改跟踪点</span><i>→</i><span>事件写入 per-CPU ring buffer</span><i>→</i><span>trace-cmd 或 tracefs 读取</span></div>

## Ftrace 能看哪些层次

函数 tracer 记录内核函数进入，function graph tracer 还能呈现调用层级与耗时；tracepoint 则是内核为稳定观测点定义的事件接口，例如 `sched_switch`、`irq_handler_entry`、`softirq_entry`。相比直接按函数名探测，tracepoint 对内核版本变化通常更友好，也更适合长期脚本化诊断。

<div class="note-map"><span><b>function tracer</b><small>查看函数调用，范围过大时数据量和开销会很高</small></span><span><b>function_graph</b><small>展示调用树与函数耗时，适合缩小后的局部路径</small></span><span><b>tracepoint</b><small>语义化事件，如调度、IRQ、块层、网络，接口更稳定</small></span><span><b>per-CPU buffer</b><small>每核独立 ring buffer，时间对齐时要保留 CPU 与时钟信息</small></span><span><b>filter/pid/cpu</b><small>限制观察对象，降低干扰并提高可读性</small></span><span><b>trace-cmd</b><small>帮助记录、保存和离线分析 trace，便于作为问题证据</small></span></div>

## 从一个具体问题开始配置

若某实时线程偶尔晚醒，不要直接打开所有函数跟踪。先记录该线程 PID、目标 CPU 和尖峰时间，再只启用调度、IRQ 与 softirq tracepoint；如果已定位到某个驱动，再加少量函数或事件。tracefs 常位于 `/sys/kernel/tracing` 或 `/sys/kernel/debug/tracing`，具体挂载路径和权限取决于系统。

```bash
# 先查看本机可用 tracer 与事件类别
cat /sys/kernel/tracing/available_tracers 2>/dev/null
ls /sys/kernel/tracing/events/sched 2>/dev/null

# 常用的第一层证据：调度、IRQ、softirq 时间线
trace-cmd record -e sched:sched_switch -e irq -e softirq
```

命令示例需要按发行版和 trace-cmd 版本调整。生产诊断还应设置缓冲区大小、运行时长和自动停止条件，避免一次 trace 填满磁盘或反过来造成新的抖动。

## 如何读一段延迟时间线

从业务 deadline 往前回溯：线程是否被唤醒？唤醒后为何没运行？同一 CPU 是否在处理 IRQ/softirq？是否有更高优先级任务、锁等待或 CPU 迁移？若内核轨迹合理却仍有时间空洞，再将视线移向 SMI、固件和硬件。Ftrace 的价值在于将“慢”变为有顺序、有 CPU、有事件名的证据链。

跟踪不该常驻在全部函数上。把一次成功定位的事件集合、filter 和分析步骤沉淀成脚本，下一次问题才能更快复现而不影响正常系统。

参考：[Ftrace](https://docs.kernel.org/trace/ftrace.html) · [trace-cmd](https://trace-cmd.org/)
