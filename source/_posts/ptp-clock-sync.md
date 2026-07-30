---
title: PTP 时间同步：让分布式设备共享微秒级时间
date: 2026-07-30 09:08:00
categories: [技术, Linux实时]
tags: [PTP, PHC, 时间同步]
---

PTP 通过 Sync、Follow_Up、Delay_Req 和 Delay_Resp 消息估计主从时钟偏差与链路延迟。硬件时间戳可在 MAC/PHY 附近记录收发时刻，减少软件栈抖动。

<div class="note-flow"><span>选择 Grandmaster</span><i>→</i><span>交换同步与延迟消息</span><i>→</i><span>硬件记录时间戳</span><i>→</i><span>估计 offset/path delay</span><i>→</i><span>伺服算法调整 PHC/系统钟</span></div>

Linux 常用 `ptp4l` 同步 PHC、`phc2sys` 再同步系统时钟。参考：[linuxptp](https://github.com/richardcochran/linuxptp)
