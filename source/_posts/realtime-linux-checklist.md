---
title: Linux 实时系统落地检查清单
date: 2026-07-30 09:10:00
categories: [技术, Linux实时]
tags: [实时Linux, 调优, 验证]
---

实时化应从需求中的周期、截止期和可接受最大抖动开始，再选择内核、调度策略、CPU/IRQ 布局、内存策略与设备驱动方案，最后在最坏负载下验证。

<div class="note-flow"><span>定义 deadline 与最坏延迟</span><i>→</i><span>配置 PREEMPT_RT 与调度</span><i>→</i><span>隔离 CPU/IRQ/内存</span><i>→</i><span>施加组合压力测试</span><i>→</i><span>追踪尖峰并形成回归基线</span></div>

验收应看最大值和长时间尾部，而非平均值；固件、BIOS、电源管理和网络同样属于实时链路。参考：[Linux Foundation Real-Time Linux](https://wiki.linuxfoundation.org/realtime/start)
