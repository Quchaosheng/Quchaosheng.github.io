---
title: TSN：以太网怎样提供确定性时延
date: 2026-07-13 10:00:00
permalink: /2026/07/30/tsn-deterministic-network/
categories: [技术, Linux实时]
tags: [TSN, 确定性网络, PTP]
---

传统以太网的核心优点是共享与尽力而为：大包可以占用链路，突发流量可以在交换机队列里等待。TSN（Time-Sensitive Networking）并不是把以太网换成另一种网络，而是在标准以太网上叠加共同时间、流量分类、整形、门控和可靠性机制，使关键流有预先安排的发送窗口和可计算的端到端时延。

<div class="note-flow"><span>PTP 同步全网时间</span><i>→</i><span>识别关键业务流</span><i>→</i><span>配置队列与 Gate Control List</span><i>→</i><span>按时间窗发送</span><i>→</i><span>监控延迟、丢包与时钟偏差</span></div>

## TSN 不是一个 qdisc，而是一组配合机制

IEEE 802.1AS/gPTP 提供共同时间；802.1Qbv 的时间感知整形（TAS）用 Gate Control List 在特定时间打开特定队列；802.1Qav 的信用整形适合某些持续媒体流；802.1Qci 可做逐流过滤和限速；帧抢占等机制则能降低高优先级帧被大包阻塞的时间。实际项目不必全部启用，但必须知道每条关键流靠哪一种机制获得保证。

<div class="note-map"><span><b>共同时间</b><small>gPTP/802.1AS 让网卡与交换机认识同一个周期边界</small></span><span><b>分类</b><small>控制、同步、视频、日志分别映射到队列或 traffic class</small></span><span><b>门控</b><small>Qbv 在时间窗内只开放关键队列，阻止背景流抢链路</small></span><span><b>整形</b><small>限制突发，避免一个业务流侵占全链路预算</small></span><span><b>端到端配置</b><small>网卡、所有交换机、对端都必须理解同一张计划</small></span><span><b>观测</b><small>同时看时钟 offset、队列丢包、门控周期和应用年龄</small></span></div>

## Gate Control List 如何理解

以 1 ms 控制周期为例，可以为控制帧预留一个短窗口，让低优先级视频/日志队列在其余时间发送：

```text
0 us -------- 100 us ------------------------- 1000 us
| 控制队列开 | 背景/视频队列开                    |
| 只放控制帧 | 允许普通流量                        |
```

这张表只是调度思想。真正的窗口长度还要包含关键帧大小、链路速率、guard band、交换机转发时间和时钟误差；在多跳网络里，每个端口的基准时刻也要对齐。若 PTP 偏移超过你的 guard band，门控再精确也会在错误时间开门。

## Linux 配置前先确认硬件能力

Linux 可以借助 `tc` 配置支持的 qdisc，例如 taprio；但软件命令成功不代表网卡、驱动和交换机已经在硬件上执行该计划。首先确认 NIC 时间戳和队列能力，核对交换机的 TSN 特性和 firmware，再在实验网络逐跳验证。

```bash
ethtool -T eth0       # 检查硬件时间戳能力
tc qdisc show dev eth0
tc -s qdisc show dev eth0
```

配置时应保存每个端口的 traffic class 映射、GCL、周期、base-time、PTP domain 和软件版本。不同节点只要有一个 base-time、优先级映射或时钟源不一致，就会出现难以解释的周期性丢帧或抖动。

## 怎样证明它真的“确定”

不要只测 ping，也不要只测本机发送时间。应在业务帧的源端、关键交换机和接收端保留硬件时间戳，测量端到端延迟、抖动、丢包与最大连续失锁时间；同时制造背景大流量、链路重连、主时钟切换和高温负载，检查关键流是否仍在预算内。

TSN 的确定性来自完整的端到端设计。单独启用某个 qdisc，或只在一块网卡上开 PTP，通常只能得到“偶尔更快”，得不到可证明的上界。

参考：[Linux TSN Documentation](https://tsn.readthedocs.io/) · [Time-Aware Priority Scheduler](https://www.kernel.org/doc/html/latest/networking/taprio.html)
