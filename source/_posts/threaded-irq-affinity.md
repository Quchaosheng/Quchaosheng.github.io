---
title: 线程化中断与 IRQ 亲和性：控制实时任务的硬件干扰
date: 2026-07-30 09:04:00
categories: [技术, Linux实时]
tags: [线程化中断, IRQ亲和性, PREEMPT_RT]
---

线程化 IRQ 只在硬中断中完成最小确认，其余处理由可调度内核线程执行。这样可为 IRQ 设置优先级与 CPU 亲和性，避免无关设备打断实时核心。

<div class="note-flow"><span>设备触发硬中断</span><i>→</i><span>顶半部确认并唤醒 IRQ 线程</span><i>→</i><span>调度器按优先级运行</span><i>→</i><span>线程处理设备事件</span><i>→</i><span>完成并重新使能</span></div>

部分关键中断仍不能线程化；错误绑核也可能让实时任务与网卡、存储中断争用同一 CPU。参考：[IRQ affinity](https://docs.kernel.org/core-api/irq/irq-affinity.html)
