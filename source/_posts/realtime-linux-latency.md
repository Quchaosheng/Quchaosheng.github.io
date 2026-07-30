---
title: 实时 Linux 抖动分析：从现象定位不可抢占区
date: 2026-05-23 14:00:00
permalink: /2026/07/29/realtime-linux-latency/
categories: [技术, Linux实时]
tags: [实时Linux, 延迟, Ftrace]
---

实时系统关心最坏延迟，而不是平均吞吐。一次短暂的 IRQ、软中断、锁竞争、缺页、频率变化、SMI 或共享内存带宽争用，都可能让周期任务错过截止期。把所有来源都叫“系统抖动”没有帮助，排查必须把尖峰固定到具体 CPU 和时间窗口。

<div class="note-flow"><span>cyclictest/rtla 捕获尖峰</span><i>→</i><span>锁定 CPU 与时间窗口</span><i>→</i><span>Ftrace 记录 IRQ/调度/osnoise</span><i>→</i><span>定位最长阻塞路径</span><i>→</i><span>修改并重复最坏值验证</span></div>

<figure class="note-visual"><figcaption><span>排查图</span>测量工具负责发现尖峰，追踪工具负责解释尖峰，复测负责证明改动。</figcaption><div class="note-map"><span><b>业务截止期</b><small>先定义任务允许晚多久，否则无法判断一个尖峰是否真的重要。</small></span><span><b>基线测量</b><small>用 cyclictest、timerlat 等工具记录分布和时间戳。</small></span><span><b>CPU 与窗口</b><small>尖峰必须对应一个 CPU 和一段可回放的时间范围。</small></span><span><b>中断与调度</b><small>用 ftrace、IRQ 统计和 osnoise 观察谁占用了 CPU。</small></span><span><b>内存与电源</b><small>缺页、回收、频率和 idle 状态也要纳入同一时间线。</small></span><span><b>单变量复测</b><small>一次只改一个因素，在相同负载下比较长尾变化。</small></span></div></figure>

## 先问任务缺了哪一段时间

周期任务的端到端时间通常包括唤醒、等待锁、读取输入、计算、发送输出和设备响应。测到 500 微秒尖峰后，先确认它发生在唤醒前、执行中还是输出后。只有把业务时间线和内核 trace 对齐，才知道该调 CPU 隔离、IRQ affinity、内存锁定，还是修应用自己的队列积压。

## 优化不是一次漂亮的最大值

测试应预热并锁定内存，配置实时优先级与 CPU 亲和性，避免测试线程迁移。空闲机器上的短测可以作为基线，但验收还要覆盖 CPU、内存、I/O、网络和真实工作负载。优化后在同一条件下比较最大值、高分位数和尖峰数量；若只留下一个更小的最大值，没有原始 trace，就无法解释它是否可复现。

参考：[实时 Linux 抖动分析](https://tinylab.org/rtlinux-latency-tracing/)
