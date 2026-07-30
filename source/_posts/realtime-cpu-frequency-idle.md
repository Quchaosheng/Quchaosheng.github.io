---
title: CPU 频率与空闲态：实时延迟中容易忽略的硬件变量
date: 2026-07-25 20:20:00
permalink: /2026/07/30/realtime-cpu-frequency-idle/
categories: [技术, Linux实时]
tags: [cpufreq, cpuidle, C-state]
---

实时线程按时被唤醒，只代表它开始有机会运行；它之后多久完成还取决于当时 CPU 的频率、缓存与电源状态。动态调频会改变每条指令的执行时间，深度 idle/C-state 则要付出退出延迟。它们能显著节能，却会引入与负载、温度、固件决策相关的长尾，所以一个空闲时非常漂亮的实时测试，在热稳定或低负载唤醒后可能突然变差。

<div class="note-flow"><span>CPU 负载下降</span><i>→</i><span>降低频率或进入深度空闲</span><i>→</i><span>实时事件到来</span><i>→</i><span>硬件恢复频率与状态</span><i>→</i><span>任务开始执行</span></div>

## 频率与 idle 影响的是两段不同时间

cpufreq 主要影响任务开始执行后的计算速度：同一段算法在低频和高频下耗时不同。cpuidle 主要影响空闲 CPU 接到事件后的恢复时间：状态越深通常越省电，但退出成本越高。两者还会受到硬件自主调频、温度保护和 BIOS 策略影响，不能简单理解为“把 governor 改成 performance 一切就好了”。

<div class="note-map"><span><b>cpufreq governor</b><small>决定或影响 CPU 频率策略，例如 schedutil/performance</small></span><span><b>硬件 P-state</b><small>具体频率还可能由硬件和热限制自主调整</small></span><span><b>cpuidle/C-state</b><small>选择空闲深度，影响唤醒时的退出延迟</small></span><span><b>温度与功耗</b><small>散热不足时即使配置高性能也会降频</small></span><span><b>实时任务</b><small>既受唤醒延迟影响，也受执行时间变化影响</small></span><span><b>正确取舍</b><small>测量后决定固定、限制或接受功耗与延迟折中</small></span></div>

## 先观察，再改变策略

不同平台的工具和可见字段不同，但可以从 sysfs 和常用工具开始确认目前的行为：

```bash
cat /sys/devices/system/cpu/cpu2/cpufreq/scaling_governor 2>/dev/null
cat /sys/devices/system/cpu/cpu2/cpufreq/scaling_cur_freq 2>/dev/null
cpupower frequency-info 2>/dev/null
cpupower idle-info 2>/dev/null
```

这些读数只是观察窗口，不一定反映硬件在每一微秒的真实状态。更重要的是把它们与 `cyclictest/rtla` 的尖峰、温度和实际业务执行时间对齐记录。

## 用实验找出合适的折中

建议至少比较三组配置：默认节能策略、限制深度 idle、偏向高性能频率。每组都在空载、CPU 压力、温度稳定和低负载长时间唤醒条件下测试。若只在低负载时尖峰明显，优先怀疑深度 idle；若高负载/高温时执行时间变长，优先检查频率和散热。

固定最高频率和禁用深度 C-state 可能适合实验室的严格 deadline，却会提高耗电、发热和风扇噪音，并可能降低整机可靠性。产品配置应该由明确的延迟预算和热设计支持，而不是从性能 benchmark 直接复制。

参考：[CPU Performance Scaling](https://docs.kernel.org/admin-guide/pm/cpufreq.html) · [CPU Idle Time Management](https://docs.kernel.org/admin-guide/pm/cpuidle.html)
