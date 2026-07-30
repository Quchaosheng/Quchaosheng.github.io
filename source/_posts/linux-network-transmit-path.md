---
title: Linux 网络发送链路：从 socket 到网卡描述符
date: 2026-05-29 14:00:00
permalink: /2026/07/29/linux-network-transmit-path/
categories: [技术, Linux网络]
tags: [网络栈, qdisc, netdevice]
---

应用调用 `sendmsg()` 后，数据并不会立刻从网线发出。它要先进入 socket 发送缓冲区，被 TCP/UDP、IP 和邻居子系统逐层补充元数据与协议头，经过 qdisc 排队/整形，最终由网卡驱动的 `ndo_start_xmit` 把 DMA 描述符提交给硬件。发送端的延迟、突发和丢包同样是分层发生的：应用返回快，不代表包已经离开主机。

<div class="note-flow"><span>sendmsg</span><i>→</i><span>TCP/UDP 构造 skb</span><i>→</i><span>IP 路由与分片</span><i>→</i><span>qdisc 排队</span><i>→</i><span>ndo_start_xmit 与 DMA</span></div>

## 从用户缓冲区到网卡的关键节点

socket 层负责发送缓冲、拥塞/流控语义与协议状态；TCP 可能按 MSS 分段，也可能借助 GSO 把大 skb 延后到更靠近网卡的位置再分段；IP 层查路由、选择出口和处理 MTU；邻居子系统解析下一跳 MAC；qdisc 依据优先级、整形或队列规则决定何时交给设备；驱动再填充 TX ring 并启动 DMA。

<div class="note-map"><span><b>socket send buffer</b><small>应用可写入的数据队列；满时 send 可能阻塞或返回 EAGAIN</small></span><span><b>TCP/UDP + IP</b><small>协议头、路由、MTU、分段/校验和等处理</small></span><span><b>neighbor</b><small>ARP/NDP 解析下一跳；邻居未就绪时包可能等待</small></span><span><b>qdisc</b><small>排队、优先级、AQM 与整形的控制点</small></span><span><b>TX ring</b><small>驱动提交 DMA 描述符的硬件队列，满时产生背压</small></span><span><b>completion</b><small>硬件发送完成后回收描述符和 skb，影响持续发送能力</small></span></div>

## GSO、qdisc 与队列不是“额外负担”

GSO 允许协议栈用较少的大 skb 表达多个 MTU 大小分段，降低每包固定开销；硬件若支持 TSO/校验和卸载，可在更晚的阶段完成分段与校验。qdisc 则是 Linux 做队列管理、流量整形和公平调度的位置。它们通常提高吞吐和可控性，但对极低延迟控制包也可能引入排队，因此要按流量类别设置策略而非全局追求最大批量。

```bash
ip -s link show dev eth0
tc qdisc show dev eth0
tc -s qdisc show dev eth0
ethtool -S eth0
```

这些输出可帮助区分接口层丢包、qdisc 排队、驱动 ring 压力与硬件错误。若应用 `send()` 频繁返回 `EAGAIN`，先检查 socket 缓冲与对端窗口；若 qdisc backlog 持续增加，则是链路/整形/出口过载问题；若 TX ring 无法及时回收，则要进一步看驱动和网卡完成路径。

## 给实时控制包设计一条明确路径

控制包的价值会随排队时间迅速降低。可以用优先级/traffic class 将它与视频、日志和批量上传分开，限制背景流突发；应用协议携带时间戳和序列号，让接收端拒绝过期命令。不要把“大 socket buffer”当成实时优化，它通常只是允许更多旧数据排队。

发送性能最终来自端到端协同：应用发送节奏、TCP/UDP 语义、qdisc、网卡队列、对端消费和交换机都必须在预算内。沿着这条链路逐层观测，比只在 `send()` 前后打时间戳可靠得多。

参考：[Linux Networking](https://docs.kernel.org/networking/index.html) · [Traffic Control](https://docs.kernel.org/networking/tc-actions-env-rules.html)
