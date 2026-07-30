---
title: 线程化中断与 IRQ 亲和性：控制实时任务的硬件干扰
date: 2026-07-08 14:00:00
permalink: /2026/07/30/threaded-irq-affinity/
categories: [技术, Linux实时]
tags: [线程化中断, IRQ亲和性, PREEMPT_RT]
---

中断是实时系统里最常见的“突然插队者”。网卡收包、存储完成、USB 设备活动都可能让 CPU 立即进入硬中断上下文；如果处理过多工作，实时线程即使优先级很高也只能等待。线程化中断的思路是把硬中断顶半部压缩到最小确认工作，其余部分交给可调度的 IRQ 线程，这样调度器、优先级和 CPU 亲和性才能参与控制。

<div class="note-flow"><span>设备触发硬中断</span><i>→</i><span>顶半部确认并唤醒 IRQ 线程</span><i>→</i><span>调度器按优先级运行</span><i>→</i><span>线程处理设备事件</span><i>→</i><span>完成并重新使能</span></div>

## 硬中断、IRQ 线程与软中断的边界

硬中断上下文不能随意睡眠，应该只做设备确认、保存最小状态和唤醒后续处理。线程化后，IRQ 处理会以一个内核线程的形式出现，通常能设置调度优先级和 CPU 亲和性。网络、块设备等子系统还可能产生软中断或后续 worker，因此把某个 IRQ 移走并不代表所有相关工作都自动离开实时 CPU。

<div class="note-map"><span><b>硬中断顶半部</b><small>确认设备、最短路径返回，减少禁止抢占时间</small></span><span><b>IRQ 线程</b><small>可被调度、可绑核，是主要处理位置</small></span><span><b>软中断/NAPI</b><small>网络等子系统可能继续消耗 CPU，需要单独观察</small></span><span><b>实时 CPU</b><small>尽量只保留控制任务和必要的本地中断</small></span><span><b>housekeeping CPU</b><small>承接网卡、存储、日志和后台设备工作</small></span><span><b>验证数据</b><small>/proc/interrupts、trace、线程 CPU 与延迟尖峰</small></span></div>

## 亲和性如何查看与调整

先从 `/proc/interrupts` 找出活跃设备与对应 IRQ 编号，再检查 `/proc/irq/<N>/smp_affinity_list`。不要凭设备名字猜测：多队列网卡会有多个 IRQ，驱动重载后编号也可能变化。

```bash
cat /proc/interrupts
cat /proc/irq/<IRQ>/smp_affinity_list

# 示例：将一个 IRQ 绑定到 CPU 2；实际 CPU 规划须先设计好
echo 2 | sudo tee /proc/irq/<IRQ>/smp_affinity_list
```

`irqbalance` 可能在后台重新移动中断，测试时应明确它的策略或停止它。反过来，也不要把所有 IRQ 粗暴塞给同一个 housekeeping CPU；那会形成软中断积压，最后通过共享缓存、内存带宽或队列满反噬实时路径。

## 一种可验证的布置方式

假设 CPU 2 专门运行 1 kHz 控制线程，CPU 0–1 用于系统杂务。可以先将控制线程绑到 CPU 2，再将高频网卡、存储和 USB IRQ 移到 CPU 0–1，随后在网络满载、磁盘 I/O、设备热插拔同时发生时运行 `cyclictest` 或业务控制测试。每次出现尖峰，都检查同一时间窗口的 IRQ 计数与调度事件。

不是所有关键中断都应迁走：某些设备的响应路径本来就必须靠近控制线程。此时更需要确保 IRQ 线程优先级、驱动执行时间和其他干扰被严格测量。目标不是“中断数量为零”，而是让每一个会打断关键任务的中断都有明确归属和上界。

参考：[IRQ affinity](https://docs.kernel.org/core-api/irq/irq-affinity.html) · [Linux IRQ Subsystem](https://docs.kernel.org/core-api/genericirq.html)
