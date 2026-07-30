---
title: Linux 时间管理：时钟源、时钟事件与定时器
date: 2026-04-24 14:00:00
permalink: /2026/07/29/linux-timekeeping/
categories: [技术, Linux内核]
tags: [timekeeping, clocksource, timer]
---

Linux 时间管理由几类不同角色的硬件和软件组成。clocksource 提供连续计数，clockevent 在指定时刻产生中断，timekeeping 把硬件周期换算成单调时间和墙上时间，定时器子系统则根据最近截止期编程下一次事件。把这些角色混为“系统时钟”，很容易在超时、校时和实时测试中选错工具。

<div class="note-flow"><span>读取 clocksource 周期</span><i>→</i><span>换算单调时间</span><i>→</i><span>定时器确定最近到期点</span><i>→</i><span>编程 clockevent</span><i>→</i><span>中断到来执行到期任务</span></div>

<figure class="note-visual"><figcaption><span>时间图</span>计时来源、时间语义和唤醒机制各有不同职责。</figcaption><div class="note-map"><span><b>clocksource</b><small>提供可读取的连续计数，如 TSC、架构计时器等。</small></span><span><b>timekeeper</b><small>根据频率和偏移将周期换算为内核时间。</small></span><span><b>CLOCK_MONOTONIC</b><small>用于持续时间和超时，不受墙上时间调整影响。</small></span><span><b>CLOCK_REALTIME</b><small>表示日历时间，可能被 NTP 或管理员校正。</small></span><span><b>clockevent</b><small>在下一次定时器截止期通过中断唤醒 CPU。</small></span><span><b>tickless</b><small>空闲或特定条件下减少周期 tick，降低无效唤醒。</small></span></div></figure>

## 超时与日志不要使用同一种时钟

日志需要可读的日历时间，通常使用 `CLOCK_REALTIME`；重试、超时和性能测量需要不会因校时跳变的时间，通常使用 `CLOCK_MONOTONIC`。如果用墙上时间计算 30 秒超时，NTP 校时或手工改时间可能让任务提前触发或长时间不超时。

跨设备关联事件时还要区分“每台机器的本地单调时间”和“经过同步的全局时间”。先把单机因果关系理清，再讨论 PTP 或 NTP 的同步精度，否则时间戳看似一致却无法支持正确排序。

## 定时器精度受唤醒路径限制

设置 1 ms 定时器只表示内核会在合适时间安排一次唤醒，不表示用户线程一定在 1 ms 后开始执行。中断延迟、调度竞争、CPU idle 退出和频率变化都会把实际运行推后。实时排查要同时看 clockevent、IRQ、线程调度和业务执行时间，不能只看定时器 API 的设定值。

参考：[Linux 时间管理](https://www.kerneltravel.net/blog/2020/clockmanagement_zjqing/)
