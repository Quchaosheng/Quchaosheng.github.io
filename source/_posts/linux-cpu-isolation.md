---
title: CPU 隔离：为实时任务留出安静的核心
date: 2026-07-30 09:05:00
categories: [技术, Linux实时]
tags: [CPU隔离, nohz_full, rcu_nocbs]
---

实时 CPU 隔离通常组合 cpuset/亲和性、`nohz_full`、`rcu_nocbs`、IRQ 迁移和 housekeeping CPU，使调度 Tick、RCU 回调与普通任务远离实时核心。

<div class="note-flow"><span>划分实时与 housekeeping CPU</span><i>→</i><span>迁移 IRQ 和内核线程</span><i>→</i><span>配置 nohz_full/rcu_nocbs</span><i>→</i><span>绑定实时任务</span><i>→</i><span>追踪残余干扰</span></div>

`isolcpus` 不是万能开关；workqueue、定时器、内存回收和固件仍可能造成抖动。参考：[Housekeeping](https://docs.kernel.org/timers/no_hz.html)
