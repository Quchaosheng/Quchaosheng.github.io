---
title: SMI 与固件延迟：Linux 追踪不到的实时尖峰从哪里来
date: 2026-07-30 09:24:00
categories: [技术, Linux实时]
tags: [SMI, NMI, 固件, 延迟]
---

x86 的系统管理中断会让处理器进入 SMM 执行固件代码，操作系统无法抢占，也通常看不到内部调用栈。若 `cyclictest` 出现尖峰，而 ftrace 时间线上像凭空少了一段时间，固件、热管理和硬件纠错活动就是重要嫌疑。
<div class="note-flow"><span>实时测试捕获尖峰</span><i>→</i><span>内核事件无法解释</span><i>→</i><span>核对 NMI/SMI 与硬件计数</span><i>→</i><span>调整 BIOS/固件策略</span><i>→</i><span>同负载长时间复测</span></div>

处理这类问题要先更新 BIOS，并逐项验证电源、风扇、USB legacy、内存巡检等选项，不能盲目关闭平台安全或散热机制。实时性是整机属性，不只由内核决定。参考：[hwlat detector](https://docs.kernel.org/trace/hwlat_detector.html)
