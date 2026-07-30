---
title: RISC-V cpuidle：空闲 CPU 如何降低功耗
date: 2026-07-03 09:30:00
permalink: /2026/07/29/riscv-cpuidle/
categories: [技术, RISC-V]
tags: [cpuidle, 功耗, 调度]
---

cpuidle 根据预计空闲时间在多个低功耗状态间选择。状态越深，节能越多，但进入、退出延迟与恢复成本也越高。

<div class="note-flow"><span>调度器发现 CPU 空闲</span><i>→</i><span>Governor 预测空闲时长</span><i>→</i><span>选择满足延迟约束的状态</span><i>→</i><span>WFI 或 SBI suspend</span><i>→</i><span>中断唤醒并统计驻留时间</span></div>

驱动描述各 idle state 的 exit latency、target residency 和进入方法，governor 做策略选择。实时系统需要限制过深状态，避免唤醒延迟破坏时限。

参考：[RISC-V cpuidle 驱动分析](https://tinylab.org/riscv-cpuidle/)
