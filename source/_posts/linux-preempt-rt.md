---
title: PREEMPT_RT：Linux 怎样变成可抢占的实时内核
date: 2026-07-30 09:01:00
categories: [技术, Linux实时]
tags: [PREEMPT_RT, 抢占, 实时Linux]
---

PREEMPT_RT 的目标是缩短内核中不可抢占区，让高优先级任务即使在内核态也能更快获得 CPU。它将大量自旋锁转换为可睡眠的 rtmutex，并尽可能把中断处理线程化。

<div class="note-flow"><span>高优先级任务被唤醒</span><i>→</i><span>检查当前抢占状态</span><i>→</i><span>抢占普通线程或内核路径</span><i>→</i><span>运行实时任务</span><i>→</i><span>完成后恢复被抢占任务</span></div>

实时内核追求的是可预测的最坏延迟，不是更高吞吐。仍不可抢占的 raw spinlock、固件中断和硬件延迟需要单独分析。参考：[Real-time Linux](https://wiki.linuxfoundation.org/realtime/start)
