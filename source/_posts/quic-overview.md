---
title: QUIC：在 UDP 之上重建可靠传输
date: 2026-05-11 14:00:00
permalink: /2026/07/29/quic-overview/
categories: [技术, Linux网络]
tags: [QUIC, HTTP3, UDP]
---

QUIC 在 UDP 上实现加密、可靠传输、拥塞控制和多路复用，是 HTTP/3 的传输基础。UDP 只负责发送数据报；确认、重传、流控、拥塞控制和 TLS 1.3 握手都由 QUIC 协议实现。把连接状态放在用户态让协议演进更快，但也要求实现方认真处理定时器、内存和丢包恢复。

<div class="note-flow"><span>UDP 收发数据报</span><i>→</i><span>QUIC 加密包与帧</span><i>→</i><span>独立 Stream 重组</span><i>→</i><span>ACK/丢包检测</span><i>→</i><span>拥塞控制与重传</span></div>

<figure class="note-visual"><figcaption><span>协议图</span>一个 QUIC 包可以承载多种帧，流和包的可靠性层次不同。</figcaption><div class="note-map"><span><b>UDP 数据报</b><small>提供尽力而为的传输，不维护连接和重传。</small></span><span><b>QUIC 包</b><small>携带加密后的帧，并由包号参与确认和丢包检测。</small></span><span><b>Stream</b><small>应用字节流独立重组，避免无关流在传输层互相阻塞。</small></span><span><b>ACK 与恢复</b><small>接收方确认包范围，发送方根据计时和 ACK 判断丢失。</small></span><span><b>拥塞控制</b><small>限制发送速率，避免把网络队列持续推满。</small></span><span><b>连接 ID</b><small>使连接可在地址变化后继续识别，但迁移仍需安全验证。</small></span></div></figure>

## 多路复用减少的是哪一种阻塞

TCP 的有序字节流在一个报文丢失后会阻塞后续字节交付，哪怕它们属于不同 HTTP 请求。QUIC 将应用数据放进独立 stream，因此一个 stream 缺失数据时，其他 stream 仍可交付已完整的数据。丢失的 QUIC 包仍然会消耗带宽和恢复时间，所以它不是“网络丢包没有影响”，而是把影响限制在相关流和拥塞窗口内。

## 连接快不等于每个请求都快

TLS 1.3 与 QUIC 紧密集成，能减少握手轮次；0-RTT 等机制还要考虑重放和幂等性。性能调试应同时观察握手、首字节时间、stream 排队、ACK 延迟和拥塞窗口，而不是只看 UDP 包数量。对服务器实现来说，连接状态、加密 CPU 开销和放大攻击限制也都是容量的一部分。

参考：[QUIC 可靠传输协议](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247484949&idx=1&sn=bb85e071e07198f2987d4527e93c7fb0)
