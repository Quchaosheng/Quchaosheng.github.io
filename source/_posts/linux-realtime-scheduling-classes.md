---
title: Linux 实时调度：SCHED_FIFO、RR 与 DEADLINE
date: 2026-07-06 14:00:00
permalink: /2026/07/30/linux-realtime-scheduling-classes/
categories: [技术, Linux实时]
tags: [SCHED_FIFO, SCHED_RR, SCHED_DEADLINE]
---

在实时系统里，“优先级更高”不是完整答案。你还要说明任务会运行多久、多久出现一次、能否被同级任务轮换，以及它超时后如何让出 CPU。Linux 提供 `SCHED_FIFO`、`SCHED_RR` 和 `SCHED_DEADLINE` 三种主要实时策略：它们服务于不同的任务模型，用错策略比不设实时优先级更危险。

<div class="note-flow"><span>任务进入可运行状态</span><i>→</i><span>比较调度类与实时优先级</span><i>→</i><span>DEADLINE 看最早截止期</span><i>→</i><span>运行并消耗预算</span><i>→</i><span>阻塞、抢占或限流</span></div>

## 三种策略分别在解决什么

`SCHED_FIFO` 是固定优先级的先进先出调度。优先级范围通常是 1 到 99；同优先级线程按就绪顺序运行，当前线程会一直占 CPU，直到阻塞、主动让出、被更高优先级任务抢占或被实时节流。它适合短小、明确会等待外部事件的控制线程。

`SCHED_RR` 与 FIFO 使用同一套优先级，但同级任务会按时间片轮转。它适合多个同等重要、都必须有机会运行的工作线程，却不适合用时间片去掩盖设计上本应拆开的长任务。

`SCHED_DEADLINE` 用 `runtime`、`deadline`、`period` 描述周期任务：一个周期内最多需要多少 CPU、必须何时完成、多久再来一次。内核依据最早截止期优先（EDF）并进行带宽准入控制，因而特别适合“每 10 ms 必须执行不超过 1 ms”的模型。

<div class="note-map"><span><b>FIFO</b><small>固定优先级；直到阻塞才让出</small></span><span><b>RR</b><small>固定优先级；同级按时间片轮转</small></span><span><b>DEADLINE</b><small>按最早截止期；使用 runtime 预算</small></span><span><b>适用任务</b><small>短控制循环、事件响应、周期计算</small></span><span><b>共同风险</b><small>长计算、锁等待、CPU 过载都会打破预期</small></span><span><b>基本原则</b><small>优先级由失效后果决定，不由“谁更重要”决定</small></span></div>

## 先算预算，再选策略

若有周期任务的最坏执行时间 `C` 和周期 `T`，它的最低 CPU 需求可先粗略写成 `U = C / T`。例如一个 10 ms 周期、最坏执行 1 ms 的任务至少需要约 10% 的一个 CPU；实际部署还要为中断、锁竞争、cache miss、驱动和系统噪声留余量。

对 `SCHED_DEADLINE`，`runtime <= deadline <= period` 是常见的起点，但并非填上就安全。多任务总预算、CPU 亲和性、共享锁和频率变化都会影响截止期。对 FIFO/RR，则应把每段不可阻塞计算限制在很短范围，主动等待事件而不是轮询占满核心。

```bash
# 示例：将一个已经验证会主动阻塞的线程设为 FIFO 80
sudo chrt -f -p 80 <pid>

# 查看线程当前调度类、实时优先级与所在 CPU
ps -eLo pid,tid,psr,cls,rtprio,comm | head -n 20
```

提高优先级需要 `CAP_SYS_NICE` 或合理的资源限制。测试时应从低优先级、单个线程开始，并准备 watchdog；一个失控的 FIFO 99 线程足以让同核上的 SSH、日志和桌面都无法及时响应。

## 一个实用的选型顺序

1. 有明确周期、预算和截止期时，先评估 `SCHED_DEADLINE`。
2. 需要严格固定优先级、执行时间很短且会自然阻塞时，考虑 FIFO。
3. 多个同级工作者要公平分享 CPU 时，考虑 RR。
4. 无论选哪种，都用 `cyclictest`、`rtla` 和业务级超时验证最坏情况。

实时策略只决定“谁先运行”，不解决页面缺失、硬中断、错误 CPU 绑定或网络对端慢的问题。把这些条件写进验收表，调度策略才不会沦为一个看起来很厉害的参数。

参考：[sched(7)](https://man7.org/linux/man-pages/man7/sched.7.html) · [Deadline Task Scheduling](https://docs.kernel.org/scheduler/sched-deadline.html)
