---
title: PREEMPT_RT：Linux 怎样变成可抢占的实时内核
date: 2026-07-21 14:10:00
permalink: /2026/07/30/linux-preempt-rt/
categories: [技术, Linux实时]
tags: [PREEMPT_RT, 抢占, 实时Linux]
---

普通 Linux 擅长吞吐量和公平性，但内核中一次较长的关抢占、硬中断或自旋锁临界区，可能让刚被唤醒的高优先级任务等上很久。对音频、运动控制、工业通信这类周期任务而言，平均延迟再低也不够，真正关心的是最坏情况下“何时一定能运行”。PREEMPT_RT 的目标正是缩短这类不可抢占区，让高优先级线程即使在内核态也能更快获得 CPU。

<div class="note-flow"><span>高优先级任务被唤醒</span><i>→</i><span>检查当前抢占状态</span><i>→</i><span>抢占普通线程或内核路径</span><i>→</i><span>运行实时任务</span><i>→</i><span>完成后恢复被抢占任务</span></div>

## PREEMPT_RT 实际改变了什么

它不是给应用程序加一个“实时开关”，而是重塑了内核中的若干执行上下文。大量原本会忙等的自旋锁，在能够睡眠的情形下会以 `rtmutex` 方式工作；当高优先级线程等待锁时，持锁者可以得到优先级继承。许多设备中断也会由可调度的 IRQ 线程完成后半段处理，使调度器可以决定它与实时任务谁先运行。

<div class="note-map"><span><b>锁</b><small>尽可能用可睡眠的 rtmutex，缩短高优先级等待</small></span><span><b>中断</b><small>将大量处理移入 IRQ 线程，减少硬中断占用</small></span><span><b>抢占</b><small>让内核路径更频繁地成为可抢占点</small></span><span><b>调度</b><small>实时线程可在更短的内核延迟后得到 CPU</small></span><span><b>仍需单独处理</b><small>raw spinlock、NMI、SMI、固件和硬件延迟</small></span><span><b>最终目标</b><small>降低并解释最坏延迟，而不是追求最高吞吐</small></span></div>

这里的“尽可能”很关键。`raw_spinlock`、部分底层时钟路径、NMI/SMI 与设备固件不一定能被抢占；驱动如果关中断太久，或者平台固件突然接管 CPU，实时补丁也无法凭空消除那段时间。因此 PREEMPT_RT 是实时系统的一层基础，不是最终证明。

## 怎样判断系统是否真的跑在 RT 内核上

首先确认构建配置中启用了 `CONFIG_PREEMPT_RT`，并在目标机上记录内核版本、启动参数、CPU 型号和 BIOS 版本。某些内核会在 `/sys/kernel/realtime` 暴露状态；无论是否有该文件，都应以实际的内核配置和延迟测试为准。

```bash
uname -a
zgrep PREEMPT_RT /proc/config.gz 2>/dev/null || \
  grep PREEMPT_RT /boot/config-$(uname -r)
test -r /sys/kernel/realtime && cat /sys/kernel/realtime
```

接着用 `cyclictest` 或 `rtla timerlat` 建立基线，并在相同硬件上比较普通内核与 RT 内核的最大值、P99 和长时间直方图。只在空闲桌面上跑几秒得到的漂亮数字，不是实时能力的证据。

## 适合它的工作，也有不适合它的工作

PREEMPT_RT 很适合降低通用 Linux 上线程唤醒、锁竞争和中断处理带来的抖动。它不替代硬实时 MCU，不自动让垃圾回收、文件系统写入或网络对端变成确定性，也不保证每个驱动都已经适配得足够好。若控制周期只有几十微秒，或失控会立刻造成物理伤害，应仍由独立控制器与硬件安全链承担最后责任。

部署顺序可以很朴素：先定义周期、截止期和最大允许抖动；再启用 RT 内核；随后布置调度、CPU/IRQ、内存和电源策略；最后在 CPU、内存、网络和 I/O 压力同时存在时捕获尖峰。每削掉一个尖峰，都要能解释它原先来自哪里。

参考：[Real-time Linux](https://wiki.linuxfoundation.org/realtime/start) · [PREEMPT_RT Documentation](https://wiki.linuxfoundation.org/realtime/documentation/start)
