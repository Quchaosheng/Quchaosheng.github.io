---
title: RT-Thread 电源管理：根据空闲时间选择睡眠深度
date: 2026-07-30 09:08:00
categories: [技术, RT-Thread]
tags: [PM, 低功耗, Tickless]
---

电源管理框架根据下一定时事件和设备约束选择运行、轻睡眠或深睡眠状态，在进入前挂起设备，唤醒后按顺序恢复并补偿系统时间。

<div class="note-flow"><span>系统进入 idle</span><i>→</i><span>计算可睡眠时长</span><i>→</i><span>设备投票限制最低状态</span><i>→</i><span>挂起设备并睡眠</span><i>→</i><span>唤醒、恢复设备与 Tick</span></div>

串口发送、Flash 写入等活动必须持有电源约束，防止操作中途关时钟。参考：[RT-Thread](https://github.com/RT-Thread/rt-thread)
