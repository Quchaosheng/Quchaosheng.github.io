---
title: rtla timerlat：定位实时系统的唤醒延迟
date: 2026-07-01 20:20:00
permalink: /2026/07/29/linux-rtla-timerlat/
categories: [技术, Linux实时]
tags: [rtla, timerlat, 实时Linux]
---

timerlat tracer 周期性设置定时器，测量定时器到期到中断处理、再到实时线程真正运行之间的延迟，从而区分 IRQ 延迟与线程调度延迟。

<div class="note-flow"><span>设置周期定时器</span><i>→</i><span>定时器到期</span><i>→</i><span>记录 IRQ 延迟</span><i>→</i><span>唤醒 timerlat 线程</span><i>→</i><span>记录线程延迟并追踪干扰源</span></div>

测试前应固定 CPU、设置实时优先级并控制频率调节等变量。发现尖峰后结合 osnoise、ftrace、IRQ 统计判断干扰来自长中断、不可抢占区、调度竞争还是固件活动。

参考：[rtla timerlat 延迟测试原理](https://tinylab.org/linux-rtla-2/)
