---
title: Linux 网络发送链路：从 socket 到网卡描述符
date: 2026-07-29 14:04:00
categories: [技术, Linux网络]
tags: [网络栈, qdisc, netdevice]
---

应用发送数据后，socket 层构造 skb，TCP/UDP 与 IP 层补充协议头并查路由，邻居子系统解析链路地址，qdisc 排队后由网卡驱动提交 DMA 描述符。

<div class="note-flow"><span>sendmsg</span><i>→</i><span>TCP/UDP 构造 skb</span><i>→</i><span>IP 路由与分片</span><i>→</i><span>qdisc 排队</span><i>→</i><span>ndo_start_xmit 与 DMA</span></div>

发送瓶颈可能来自 socket 缓冲区、分段、路由、队列规则、锁竞争或网卡 ring；必须按层观察，而不是只看应用耗时。

参考：[Linux 内核网络数据发送](https://www.kerneltravel.net/blog/2020/network_ljr11/)
