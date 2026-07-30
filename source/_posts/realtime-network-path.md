---
title: Linux 实时网络路径：从网卡中断到应用线程
date: 2026-07-27 14:10:00
permalink: /2026/07/30/realtime-network-path/
categories: [技术, Linux实时]
tags: [NAPI, IRQ亲和性, 实时网络]
---

应用线程收到一个网络包之前，数据通常已经走过网卡 DMA、RX queue、中断、NAPI、协议栈、socket 队列和一次线程唤醒。任何一段的 CPU 迁移、队列积压、软中断预算、内存分配或锁竞争，都可能让端到端延迟比“网卡中断很快”大得多。实时网络优化因此不是把应用优先级调高，而是让整条路径的队列、CPU 和时间戳都可见。

<div class="note-flow"><span>网卡收到数据包</span><i>→</i><span>IRQ 唤起 NAPI</span><i>→</i><span>协议栈处理并入 socket</span><i>→</i><span>唤醒实时应用</span><i>→</i><span>记录端到端延迟</span></div>

## 把收包路径拆开看

网卡将报文 DMA 到 RX ring；随后 IRQ 提醒 CPU，Linux 常在 NAPI 轮询中批量收包以避免中断风暴；协议栈解析以太网/IP/UDP/TCP，将数据放入 socket 接收队列；最后阻塞在 `recvmsg`/`epoll` 的应用线程才被唤醒。高吞吐时，NAPI、softirq 和 `ksoftirqd` 的行为尤其重要，它们可能把很多包聚在一次调度中处理。

<div class="note-map"><span><b>RX queue / RSS</b><small>决定硬件把不同流量送到哪个队列/CPU</small></span><span><b>IRQ</b><small>将队列事件送入 CPU，亲和性影响第一跳的位置</small></span><span><b>NAPI</b><small>批量轮询收包，降低 IRQ 风暴但引入批处理取舍</small></span><span><b>softirq/ksoftirqd</b><small>协议栈后续处理的 CPU 归属可能与应用不同</small></span><span><b>socket queue</b><small>应用消费不足会增加排队和数据年龄</small></span><span><b>应用线程</b><small>需在正确 CPU 被及时唤醒，并识别过期数据</small></span></div>

## 优化前先记录“数据年龄”

只测 `recv()` 返回后的时间没有意义，因为包可能已在队列里等很久。应尽可能记录源端发送时间、网卡/内核时间戳和应用消费时刻，至少得到：

```text
network_age = application_consume_time - source_send_time
socket_wait = application_consume_time - kernel_receive_time
```

若硬件允许，可研究 `SO_TIMESTAMPING` 与网卡硬件时间戳；若协议本身有序号和发送时刻，也应让业务消息携带它们。没有原始时间戳，排队问题常被误判成“网络偶尔慢”。

## CPU 与队列要一起规划

让一个关键 UDP 流的 RX queue、IRQ、NAPI 处理和应用线程尽量靠近同一个 CPU/NUMA 节点，能减少迁移和缓存抖动；但不能把所有网络工作塞到实时控制核。高吞吐背景流通常应放到 housekeeping CPU，必要时用 RSS/RPS/RFS 等机制调整分流，并持续看 `/proc/interrupts`、socket 丢包和 softnet 统计。

```bash
cat /proc/interrupts
cat /proc/net/softnet_stat
ss -u -i
```

这些命令只给出排障起点，字段需要结合内核版本和流量理解。一次修改 RSS、IRQ 或 NAPI 参数后，要在真实包长、并发和背景流下复测，而不是只对 ping 做优化。

## 过期包比丢包更危险时怎么办

控制系统常宁可丢弃过期状态，也不愿使用 300 ms 前的命令。应用协议应带序列号和时间戳，接收端定义最大可接受年龄；超过阈值的包直接丢弃或触发降级，而不是悄悄在 socket 队列里排队消费。网络实时性的核心是“信息在 deadline 内有用”，不是“每个字节最终都可靠送达”。

参考：[Scaling in the Linux Networking Stack](https://docs.kernel.org/networking/scaling.html) · [socket timestamping](https://docs.kernel.org/networking/timestamping.html)
