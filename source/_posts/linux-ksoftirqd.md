---
title: ksoftirqd：软中断为何会转入内核线程
date: 2026-06-02 14:00:00
permalink: /2026/07/29/linux-ksoftirqd/
categories: [技术, Linux内核]
tags: [软中断, ksoftirqd, 网络]
---

硬中断必须尽快返回，因此 Linux 将大量可延后的处理放进 softirq，例如网络收包、定时器和任务队列。softirq 可以在中断返回路径上被处理，延迟低，但若它持续工作太久，就会长时间占据 CPU、拖慢用户线程和其他中断。内核因此对处理次数/时间设预算，超过预算的剩余工作交给每 CPU 一个 `ksoftirqd/N` 内核线程继续完成。

<div class="note-flow"><span>硬中断触发 softirq</span><i>→</i><span>中断返回路径处理</span><i>→</i><span>超过预算</span><i>→</i><span>唤醒 ksoftirqd/N</span><i>→</i><span>线程上下文继续处理</span></div>

## 为什么有 ksoftirqd 反而是好事

它不是“网络慢了才出现的坏线程”，而是防止 softirq 在不可控上下文中无限运行的安全阀。转入线程上下文后，调度器可以让其他任务获得 CPU，也能更清楚地观察该工作占了多少时间。问题不在于 `ksoftirqd` 存在，而在于它持续高占用时说明包量、队列分布、应用消费或 CPU 布局存在失衡。

<div class="note-map"><span><b>硬中断</b><small>通知设备事件，尽量短，通常只触发后续工作</small></span><span><b>softirq</b><small>低延迟处理网络/定时器等，但有执行预算</small></span><span><b>NAPI</b><small>网络收包批量轮询机制，常在 NET_RX softirq 中运行</small></span><span><b>ksoftirqd/N</b><small>每 CPU 线程，接手超出预算的剩余 softirq 工作</small></span><span><b>实时影响</b><small>若与控制线程同核，高包量会制造可见的抖动</small></span><span><b>治理方向</b><small>调整 IRQ/RSS/NAPI/应用消费与 CPU 隔离，而非只改优先级</small></span></div>

## 从统计判断是哪一类压力

`/proc/softirqs` 按 CPU 列出各类 softirq 计数，`/proc/interrupts` 显示设备中断，`/proc/net/softnet_stat` 可以帮助观察网络接收处理压力。一次瞬时值不够，最好在出现业务延迟时前后各采集一次并比较增量。

```bash
cat /proc/softirqs
cat /proc/interrupts
cat /proc/net/softnet_stat
ps -eLo pid,tid,psr,cls,rtprio,comm | grep ksoftirqd
```

若某个 `ksoftirqd/N` 长期忙，而对应 CPU 也承担实时任务，先检查网卡队列/IRQ 是否集中到同一核、是否有 RSS 分流失衡、应用是否来不及读取 socket。盲目提高 `ksoftirqd` 优先级可能让网络更顺畅，却让实时控制更糟。

## 调优应该沿着数据路径做

把高吞吐背景流移到 housekeeping CPU；让关键流的 RX queue、IRQ、NAPI 和应用线程在合理的 CPU/NUMA 范围内保持局部性；控制包则带时间戳和过期策略，避免 socket 队列中的旧数据被迟到消费。对实时系统来说，关键不是把所有 softirq 消灭，而是让它们在可预测的位置、以可预测的预算运行。

当 `ksoftirqd` 变忙时，它通常是在提醒你：硬件队列、协议栈和应用处理速度之间的平衡已经被打破。将这个提醒和实际丢包、延迟直方图一起记录，才能做出正确修复。

参考：[Linux networking scaling](https://docs.kernel.org/networking/scaling.html) · [Softirqs](https://docs.kernel.org/core-api/softirq.html)
