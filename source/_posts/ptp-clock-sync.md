---
title: PTP 时间同步：让分布式设备共享微秒级时间
date: 2026-07-30 09:08:00
categories: [技术, Linux实时]
tags: [PTP, PHC, 时间同步]
---

分布式实时系统不只需要每台设备“走得很准”，还需要所有设备对“现在几点”有相同理解。相机曝光、伺服控制、TSN 门控和多传感器融合都依赖共同时间轴。PTP（IEEE 1588）通过同步与延迟测量消息估计从时钟相对主时钟的偏差；若网卡支持硬件时间戳，收发时刻会在 MAC/PHY 附近记录，能避开操作系统调度与协议栈抖动。

<div class="note-flow"><span>选择 Grandmaster</span><i>→</i><span>交换同步与延迟消息</span><i>→</i><span>硬件记录时间戳</span><i>→</i><span>估计 offset/path delay</span><i>→</i><span>伺服算法调整 PHC/系统钟</span></div>

## 四个时间戳怎样得到偏差

在常见的双向延迟测量里，主机发送 Sync 时刻为 `t1`，从机收到时刻为 `t2`；从机发送 Delay_Req 为 `t3`，主机收到为 `t4`。在链路往返近似对称时，可以用下式估计平均链路时延和主从 offset：

```text
mean_path_delay = ((t2 - t1) + (t4 - t3)) / 2
offset_from_master = (t2 - t1) - mean_path_delay
```

真实网络未必完全对称，所以链路配置、交换机行为、光电转换和时间戳位置都会影响结果。硬件时间戳不能消除物理不对称，却能消除大量软件排队噪声，是微秒级目标的重要基础。

<div class="note-map"><span><b>Grandmaster</b><small>按 BMCA 选出的参考时钟，提供全网时间基准</small></span><span><b>PHC</b><small>网卡的 PTP Hardware Clock，独立于系统 CLOCK_REALTIME</small></span><span><b>ptp4l</b><small>在网络端口间运行 PTP 协议并校准 PHC</small></span><span><b>phc2sys</b><small>在 PHC 与系统时钟之间传递已同步时间</small></span><span><b>硬件时间戳</b><small>在靠近收发器的位置记录时刻，减少软件抖动</small></span><span><b>监控</b><small>持续观察 offset、频率调整和锁定状态，而非只看启动成功</small></span></div>

## Linux 上的基本检查和启动顺序

先确认网卡及驱动是否暴露硬件时间戳能力，再启动 PTP 协议，最后按需求把 PHC 同步到系统时钟。接口名、主从角色和域号要按网络设计配置，下面只是单端口实验的起点。

```bash
ethtool -T eth0
sudo ptp4l -i eth0 -m -H
sudo phc2sys -s eth0 -c CLOCK_REALTIME -w
```

`ethtool -T` 用于查看时间戳能力；`ptp4l` 负责网络侧同步；`phc2sys` 常用于将网卡 PHC 与系统时钟关联。生产系统还应以配置文件固定 profile、domain、transport 与日志级别，而不是靠命令行临时试出来。

## 哪些现象说明 PTP 没有真正“锁住”

只要看到服务启动，不等于时间已经可靠。应持续记录 offset 的均值、标准差和最大值，观察 servo 是否频繁从锁定状态退回；还要检查网卡是否退回软件时间戳、交换机是否支持所需 PTP profile，以及系统负载升高后 offset 是否恶化。

多网卡设备尤其要明确哪一块 PHC 是时间源。若相机、EtherCAT、TSN 网卡各自有时钟，却没有统一同步关系，日志看上去都带“正确时间戳”，实际仍然无法对齐。

参考：[linuxptp](https://github.com/richardcochran/linuxptp) · [Linux PTP hardware clock infrastructure](https://docs.kernel.org/driver-api/ptp.html)
