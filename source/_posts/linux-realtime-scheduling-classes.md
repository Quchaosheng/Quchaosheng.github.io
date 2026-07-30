---
title: Linux 实时调度：SCHED_FIFO、RR 与 DEADLINE
date: 2026-07-30 09:02:00
categories: [技术, Linux实时]
tags: [SCHED_FIFO, SCHED_RR, SCHED_DEADLINE]
---

FIFO 任务一直运行到阻塞、主动让出或被更高优先级任务抢占；RR 在同优先级 FIFO 规则上增加时间片；DEADLINE 用 runtime、deadline、period 描述任务预算。

<div class="note-flow"><span>任务进入可运行状态</span><i>→</i><span>比较调度类与实时优先级</span><i>→</i><span>DEADLINE 看最早截止期</span><i>→</i><span>运行并消耗预算</span><i>→</i><span>阻塞、抢占或限流</span></div>

实时任务若不阻塞可能饿死普通任务，必须设置预算、看门狗与权限边界。参考：[sched(7)](https://man7.org/linux/man-pages/man7/sched.7.html)
