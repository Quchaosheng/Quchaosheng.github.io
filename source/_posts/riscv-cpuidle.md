---
title: RISC-V cpuidle：空闲 CPU 如何降低功耗
date: 2026-05-17 14:00:00
permalink: /2026/07/29/riscv-cpuidle/
categories: [技术, RISC-V]
tags: [cpuidle, 功耗, 调度]
---

cpuidle 根据预计空闲时间在多个低功耗状态间选择。状态越深，节能越多，但进入、退出延迟与恢复成本也越高。RISC-V 平台可能只用本地 `WFI`，也可能通过固件和电源域进入更深状态；内核需要知道每种状态的收益和代价，才不会为了省一点电而错过下一个截止期。

<div class="note-flow"><span>调度器发现 CPU 空闲</span><i>→</i><span>Governor 预测空闲时长</span><i>→</i><span>选择满足延迟约束的状态</span><i>→</i><span>WFI 或 SBI suspend</span><i>→</i><span>中断唤醒并统计驻留时间</span></div>

<figure class="note-visual"><figcaption><span>状态图</span>深度状态必须同时满足空闲时间足够长和下一次唤醒允许足够慢。</figcaption><div class="note-map"><span><b>预测空闲</b><small>governor 估计下一次定时器或调度事件何时到来。</small></span><span><b>target residency</b><small>预计空闲短于这个时间，进入深状态通常得不偿失。</small></span><span><b>exit latency</b><small>从状态退出到 CPU 可运行的时间，直接影响唤醒预算。</small></span><span><b>WFI</b><small>等待中断的基础指令，是否真正省电取决于平台实现。</small></span><span><b>平台状态</b><small>更深的电源域、时钟和固件状态需要驱动正确描述。</small></span><span><b>实时约束</b><small>紧周期任务可能需要限制或禁用某些深度状态。</small></span></div></figure>

## 状态表是驱动和固件之间的契约

cpuidle 驱动向内核描述每个状态的名称、进入方法、target residency 和 exit latency。数字不能凭空填写：过小会让 governor 频繁选择收益很低的状态，过大则可能错过节能机会；更危险的是低估退出延迟，让实时任务在不可接受的时间后才开始执行。

不同 RISC-V SoC 的固件可能决定了 WFI 之后能否关闭时钟、如何接收唤醒中断、是否支持更深的 suspend。驱动应以平台文档和实际测量为依据，不能把另一块板子的状态表原样复制过来。

## 实时任务先看尾延迟，再谈节能

对周期控制或低延迟网络，先测 CPU 从 idle 被唤醒的长尾。若深状态带来偶发尖峰，可以限制该 CPU 的 cpuidle 状态、调整任务亲和性或让实时核保持较浅状态。节能和实时性不是绝对对立，但需要按角色分配 CPU，而不是给所有核套同一条策略。

参考：[RISC-V cpuidle 驱动分析](https://tinylab.org/riscv-cpuidle/)
