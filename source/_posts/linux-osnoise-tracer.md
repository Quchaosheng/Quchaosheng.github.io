---
title: osnoise tracer：把 Linux 实时抖动拆成可解释的噪声
date: 2026-07-30 09:21:00
categories: [技术, Linux实时]
tags: [osnoise, rtla, Ftrace]
---

`osnoise` 在指定 CPU 上运行采样线程，用预期运行时间减去线程真正获得的 CPU 时间，并结合 IRQ、SoftIRQ、NMI 和线程事件统计噪声来源。它适合回答“这段延迟是谁占走的”，与负责捕获唤醒尖峰的 `timerlat` 互为补充。
<div class="note-flow"><span>建立采样时间窗</span><i>→</i><span>持续读取运行时间</span><i>→</i><span>发现时间缺口</span><i>→</i><span>关联 IRQ/线程等事件</span><i>→</i><span>锁定主要噪声源</span></div>

采样时要绑定 CPU，并同时记录测试负载、频率策略和中断布局。若缺口没有对应普通内核事件，应继续检查 NMI、SMI、虚拟化抢占或固件活动。参考：[OSNOISE Tracer](https://docs.kernel.org/trace/osnoise-tracer.html)
