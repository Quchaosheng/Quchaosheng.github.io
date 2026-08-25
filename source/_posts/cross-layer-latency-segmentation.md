---
title: 跨层时延怎么定位：先把一次超时拆成三段
date: 2026-08-15 20:30:00
permalink: /2026/08/15/cross-layer-latency-segmentation/
categories: [技术, 项目方法]
tags: [Linux, ROS 2, 调度, tracing]
---

一次控制回调超时，表面上只有一个总耗时。直接看 CPU 利用率或某一行日志，往往会把排队、调度和执行混在一起。我的做法是先建立统一事件时间线，再把一次请求拆成三个可验证区间。

<div class="note-flow"><span>进入业务队列</span><i>→</i><span>线程变为 runnable</span><i>→</i><span>线程获得 CPU</span><i>→</i><span>回调执行完成</span></div>

<div class="note-map"><span><b>业务事件</b><small>标记请求与阶段</small></span><span><b>调度事件</b><small>观察 wakeup 和 switch</small></span><span><b>证据质量</b><small>记录时钟与丢失</small></span></div>

## 三段分别回答什么

**队列等待**回答执行器或任务系统有没有积压；**runnable-to-running** 回答线程已经可运行却为何迟迟没有获得 CPU；**回调执行**回答函数本身、锁、I/O 或下游调用是否变慢。三段相加接近业务端观测到的总耗时，才说明事件关联大体闭合。

业务埋点负责标记请求身份和阶段，调度事件提供 wakeup 与 switch，必要时再加入 IRQ、系统调用或网络事件。关联键不能只用 TID：线程 ID 会复用，长时间记录还需要进程实例、生命周期、单调时钟和合理时间窗。

## “看到相关”不等于“找到根因”

wakeup 到 switch-in 很长，只能说明调度等待变长。它可能来自优先级、抢占、中断、迁核、单核热点或竞争线程。下一步应针对候选原因做反证，例如固定亲和性、制造可控 CPU 竞争、调整任务负载，并观察对应区间是否按预期变化。

同样，平均 CPU 利用率不高也不能排除短时热点。控制系统关心的是窗口内的尾部延迟，而不是几秒钟平均值。

## 证据质量必须成为输出

跨源追踪要记录时钟域、事件丢失、探针开销和版本。关键事件缺失时，结果应降级为“候选方向”或“证据不足”，而不是补出一条完整故事。能够拒绝假结论，是诊断系统的重要能力。

## 参考资料

- [Linux scheduler tracepoints](https://www.kernel.org/doc/html/latest/trace/tracepoints.html)
- [ROS 2 tracing](https://docs.ros.org/en/rolling/Concepts/Intermediate/About-Logging-and-Logger-Configuration.html#ros-2-tracing)

## 证据边界

本文只描述时延分段与证据关联方法，不包含具体设备、线程名称、调度参数、现场日志或性能数字。
