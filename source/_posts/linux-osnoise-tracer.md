---
title: osnoise tracer：把 Linux 实时抖动拆成可解释的噪声
date: 2026-07-25 09:30:00
permalink: /2026/07/30/linux-osnoise-tracer/
categories: [技术, Linux实时]
tags: [osnoise, rtla, Ftrace]
---

实时延迟出现尖峰时，最难回答的问题通常不是“慢了多少”，而是“这段时间谁占走了”。`osnoise` tracer 在指定 CPU 上运行采样线程，比较预期可运行的时间与线程实际获得的运行时间，并将时间缺口关联到 IRQ、softirq、NMI、调度和其他内核事件。它像一台专门测系统噪声的听诊器，适合将“偶尔抖一下”拆成可追查的干扰类型。

<div class="note-flow"><span>建立采样时间窗</span><i>→</i><span>持续读取运行时间</span><i>→</i><span>发现时间缺口</span><i>→</i><span>关联 IRQ/线程等事件</span><i>→</i><span>锁定主要噪声源</span></div>

## osnoise 与 timerlat 的分工

`timerlat` 从定时器到期开始，关注 IRQ 延迟和被唤醒线程真正获得 CPU 的延迟；`osnoise` 则在一个 CPU 上持续观察“本应属于采样线程的时间为什么消失”。前者更适合解释周期唤醒尖峰，后者更适合枚举该 CPU 长期存在的各种噪声。二者通常应配合：先用 `cyclictest/timerlat` 发现 deadline 风险，再用 `osnoise` 和 ftrace 追根因。

<div class="note-map"><span><b>IRQ</b><small>设备硬中断或线程化中断抢走 CPU 时间</small></span><span><b>softirq/NAPI</b><small>网络、定时器等下半部可能产生持续噪声</small></span><span><b>调度活动</b><small>无关线程迁入、抢占或内核 worker 执行</small></span><span><b>NMI/SMI</b><small>普通调度轨迹难解释时的重要嫌疑</small></span><span><b>CPU 电源状态</b><small>频率与 idle 退出延迟会改变可运行窗口</small></span><span><b>关联证据</b><small>trace、IRQ 计数、温度、负载和启动参数缺一不可</small></span></div>

## 先让测量条件可重复

采样线程应绑定到要研究的 CPU，尽量避免测试程序自身在核心间迁移。启动前记录 CPU 隔离配置、IRQ 分布、频率 governor、C-state、内核版本和系统负载；否则同一个“最大噪声”无法与下次比较。

```bash
# 先查看 rtla 提供的子命令与本机内核支持情况
rtla --help
rtla osnoise --help

# 同时观察目标 CPU 的中断和线程布局
cat /proc/interrupts
ps -eLo pid,tid,psr,cls,rtprio,comm
```

不同内核版本的 `rtla osnoise` 参数会有差异，因此更稳妥的做法是先阅读本机 `--help`，把实际命令、持续时间和阈值写入测试脚本，而不是复制一条未知版本的命令。

## 从一个缺口走到根因

发现一个 300 微秒缺口后，先锁定它发生的时间窗口和 CPU。若同时看到某个网卡 IRQ 或 `ksoftirqd` 活跃，优先检查 IRQ affinity、队列和 NAPI；若 trace 中没有合理的内核事件，却在温度或 BIOS 事件附近反复出现，则继续怀疑 NMI、SMI 或固件。每次只调整一个因素，然后在同一负载、同一时间长度下复测。

`osnoise` 不会直接替你修复系统，它提供的是归因线索。只有把结果与业务级超时、硬件中断、功耗状态和实际负载一起保存，尖峰才会从“偶然”变成可工程化处理的问题。

参考：[OSNOISE Tracer](https://docs.kernel.org/trace/osnoise-tracer.html) · [rtla](https://docs.kernel.org/tools/rtla/index.html)
