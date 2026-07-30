---
title: lwIP 数据路径：小内存设备如何运行 TCP/IP
date: 2026-05-08 14:00:00
permalink: /2026/07/29/lwip-packet-path/
categories: [技术, 嵌入式网络]
tags: [lwIP, TCP-IP, pbuf]
---

lwIP 用 `pbuf` 描述报文，通过网卡 `netif` 输入 IP 层，再分发到 UDP/TCP 与应用接口；发送方向则反向封装并交给驱动输出。它能在小内存系统运行 TCP/IP，但内存池大小、pbuf 生命周期、线程模型和驱动缓冲区所有权都要明确，否则吞吐一上来就会变成难复现的丢包或内存损坏。

<div class="note-flow"><span>驱动收到帧</span><i>→</i><span>构造 pbuf</span><i>→</i><span>ethernet_input/IP</span><i>→</i><span>TCP/UDP PCB</span><i>→</i><span>应用回调或 socket</span></div>

<figure class="note-visual"><figcaption><span>缓冲图</span>`pbuf` 可以串联，引用计数和释放时机必须覆盖驱动到应用的整条路径。</figcaption><div class="note-map"><span><b>RX 描述符</b><small>网卡 DMA 写入缓冲区，驱动决定何时可重新交给硬件。</small></span><span><b>pbuf</b><small>描述数据段和链表关系，未必等于一次 malloc 的连续内存。</small></span><span><b>netif 输入</b><small>处理以太网头、ARP 和 IP，再交给协议控制块。</small></span><span><b>TCP/UDP PCB</b><small>保存连接、窗口、重传和回调状态。</small></span><span><b>线程模型</b><small>RAW API、tcpip_thread 和 socket API 对并发调用有不同要求。</small></span><span><b>释放路径</b><small>应用、协议栈和驱动谁减少引用必须可追踪。</small></span></div></figure>

## 零拷贝前先画所有权

让 pbuf 直接引用 DMA 缓冲区可以减少复制，但驱动不能在协议栈或应用仍持有它时把同一缓冲区重新交给网卡。需要定义引用计数、缓存一致性和回收回调；若这些规则不清楚，一次看似成功的 zero-copy 优化会变成偶发的数据错乱。

## 内存池和 TCP 窗口要随负载一起配置

PBUF 池过小会在突发流量下耗尽，TCP 窗口和发送缓冲过小会限制吞吐，过大又会挤占其他实时任务的 RAM。用真实包长、并发连接数和峰值流量估算，再通过统计 pbuf 耗尽、重传、丢包和任务栈余量调参。不要只根据一条 ping 或单连接测速决定配置。

参考：[lwIP](https://www.nongnu.org/lwip/)
