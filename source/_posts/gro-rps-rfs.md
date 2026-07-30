---
title: GRO、RPS 与 RFS：Linux 收包如何降低每包成本
date: 2026-06-01 14:00:00
permalink: /2026/07/29/gro-rps-rfs/
categories: [技术, Linux网络]
tags: [GRO, RPS, RFS]
---

高 PPS 网络负载的瓶颈常不是带宽，而是“每来一个包就要走一遍完整协议栈”的固定成本。Linux 在不同层提供多种分流与合并机制：硬件 RSS 先把流量分到多个 RX queue；GRO 合并同一流可合并的连续报文；RPS 用软件把包分配到其他 CPU；RFS 在 RPS 基础上尝试让处理 CPU 靠近最终消费该 socket 的应用线程。它们都在吞吐、延迟、缓存局部性和 CPU 间通信之间取舍。

<div class="note-flow"><span>NAPI 收包</span><i>→</i><span>GRO 合并报文</span><i>→</i><span>RPS 选择处理 CPU</span><i>→</i><span>RFS 参考 socket 所在 CPU</span><i>→</i><span>协议栈与应用处理</span></div>

## 四个机制解决的不是同一个问题

RSS 是网卡硬件按 hash 把不同流分到 RX queue/CPU，通常是多队列网卡的第一选择；GRO 在本 CPU 上把可合并的小包组成更大的 skb，减少 TCP/IP 每包处理；RPS 在硬件 RSS 不足、单队列设备或软件分流需要时，将包排到其他 CPU；RFS 则利用 socket 消费位置，尝试降低“协议栈在 CPU A、应用在 CPU B”的 cache 迁移。

<div class="note-map"><span><b>RSS</b><small>硬件分流到多个 RX queue；性能好，依赖 NIC 队列和 hash 能力</small></span><span><b>GRO</b><small>合并同流报文，降低每包协议栈开销，可能增加批处理延迟</small></span><span><b>RPS</b><small>软件选择处理 CPU，弥补硬件队列不足但会产生跨核工作</small></span><span><b>RFS</b><small>尝试追随 socket 消费 CPU，改善缓存局部性</small></span><span><b>XPS</b><small>发送侧队列选择机制，和 RPS/RFS 不是同一方向</small></span><span><b>验证指标</b><small>每 CPU softirq、IPI、cache miss、包年龄、吞吐与丢包</small></span></div>

## 为什么“全都打开”通常不是答案

硬件 RSS 已经按流均匀分到正确 CPU 时，额外 RPS 可能让包跨 CPU 排队、产生 IPI，反而增加延迟。GRO 对大吞吐 TCP 流十分有益，但对需要逐包时间边界的业务可能改变观察颗粒度。RFS 依赖应用实际在哪个 CPU 消费 socket，若线程频繁迁移，映射本身也会抖动。

因此调优应从拓扑开始：网卡有多少 queue、RSS indirection 是否均衡、关键应用线程在哪个 CPU、同一 NUMA 节点的缓存和内存带宽是否足够。然后只引入解决当前瓶颈的一项机制，并在相同流量下比较。

```bash
ethtool -l eth0
ethtool -x eth0 2>/dev/null
cat /proc/softirqs
cat /proc/interrupts
```

RPS/RFS 相关 CPU map 和 flow table 通常位于网卡队列的 sysfs 属性下，具体路径和可用值随内核/驱动不同。配置前先读取当前值并保存，避免把实验状态留在生产机上。

## 实时与高吞吐如何分开思考

视频、日志和大下载通常受益于批量和分流；控制或时间敏感 UDP 流更关心数据年龄和顺序。可以让两类流走不同队列/CPU/优先级，并在应用层保留时间戳与过期策略。优化目标不应只是 PPS 最大，而应是关键流在背景负载下仍在 deadline 内被消费。

参考：[Linux networking scaling](https://docs.kernel.org/networking/scaling.html) · [GRO](https://docs.kernel.org/networking/gro.html)
