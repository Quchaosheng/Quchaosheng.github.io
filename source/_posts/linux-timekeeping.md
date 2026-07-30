---
title: Linux 时间管理：时钟源、时钟事件与定时器
date: 2026-07-11 09:30:00
permalink: /2026/07/29/linux-timekeeping/
categories: [技术, Linux内核]
tags: [timekeeping, clocksource, timer]
---

clocksource 提供连续时间计数，clockevent 设备负责在指定时刻触发中断，timekeeping 把硬件计数转换为单调时间与墙上时间，定时器子系统在其上调度回调。

<div class="note-flow"><span>读取 clocksource 周期</span><i>→</i><span>换算单调时间</span><i>→</i><span>定时器确定最近到期点</span><i>→</i><span>编程 clockevent</span><i>→</i><span>中断到来执行到期任务</span></div>

实时钟可被校时调整，单调钟不会倒退；超时测量应使用 monotonic clock。tickless 模式减少无事可做时的周期中断，有利于功耗和虚拟化。

参考：[Linux 时间管理](https://www.kerneltravel.net/blog/2020/clockmanagement_zjqing/)
