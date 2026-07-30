---
title: 实时 Linux 抖动分析：从现象定位不可抢占区
date: 2026-05-23 14:00:00
permalink: /2026/07/29/realtime-linux-latency/
categories: [技术, Linux实时]
tags: [实时Linux, 延迟, Ftrace]
---

实时系统关注最坏延迟，而不是平均吞吐。抖动可能来自长 IRQ、软中断、关闭抢占、锁竞争、缺页、频率变化、SMI 或其他 CPU 的共享资源干扰。

<div class="note-flow"><span>cyclictest/rtla 捕获尖峰</span><i>→</i><span>锁定 CPU 与时间窗口</span><i>→</i><span>Ftrace 记录 IRQ/调度/osnoise</span><i>→</i><span>定位最长阻塞路径</span><i>→</i><span>修改并重复最坏值验证</span></div>

测试应预热并锁定内存，配置实时优先级与 CPU 亲和性，避免测试线程迁移。优化后必须在相同负载和足够长时间内比较最大值与高分位数。

参考：[实时 Linux 抖动分析](https://tinylab.org/rtlinux-latency-tracing/)
