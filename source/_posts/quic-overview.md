---
title: QUIC：在 UDP 之上重建可靠传输
date: 2026-06-30 20:20:00
permalink: /2026/07/29/quic-overview/
categories: [技术, Linux网络]
tags: [QUIC, HTTP3, UDP]
---

QUIC 在 UDP 上实现加密、可靠传输、拥塞控制和多路复用，是 HTTP/3 的传输基础。它把连接状态放在用户态协议实现中，便于演进。

<div class="note-flow"><span>UDP 收发数据报</span><i>→</i><span>QUIC 加密包与帧</span><i>→</i><span>独立 Stream 重组</span><i>→</i><span>ACK/丢包检测</span><i>→</i><span>拥塞控制与重传</span></div>

QUIC 的流独立减少 TCP 层队头阻塞；连接 ID 支持网络地址变化后的迁移；TLS 1.3 集成握手降低建连时延。UDP 不可靠并不意味着 QUIC 不可靠，可靠性由 QUIC 自己实现。

参考：[QUIC 可靠传输协议](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247484949&idx=1&sn=bb85e071e07198f2987d4527e93c7fb0)
