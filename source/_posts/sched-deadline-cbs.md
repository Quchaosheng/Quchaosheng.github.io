---
title: SCHED_DEADLINE：用运行预算和截止期调度周期任务
date: 2026-07-30 09:25:00
categories: [技术, Linux实时]
tags: [SCHED_DEADLINE, EDF, CBS]
---

`SCHED_DEADLINE` 用 runtime、deadline、period 描述任务需求，调度时优先选择绝对截止期最早的任务。内核通过 CBS 控制任务在每个周期内的运行预算，避免某个任务超量执行破坏其他任务的时间保证。
<div class="note-flow"><span>声明 runtime/deadline/period</span><i>→</i><span>内核执行准入检查</span><i>→</i><span>按最早截止期运行</span><i>→</i><span>消耗完预算后节流</span><i>→</i><span>下周期补充并重排</span></div>

参数必须来自最坏执行时间测量，并为中断、共享锁和系统噪声留出余量。准入成功只说明带宽模型可行，不等于任务在真实硬件上必然按期完成。参考：[Deadline Task Scheduling](https://docs.kernel.org/scheduler/sched-deadline.html)
