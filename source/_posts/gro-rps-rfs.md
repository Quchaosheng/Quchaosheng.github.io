---
title: GRO、RPS 与 RFS：Linux 收包如何降低每包成本
date: 2026-07-29 14:08:00
categories: [技术, Linux网络]
tags: [GRO, RPS, RFS]
---

GRO 合并同一流的连续报文，降低协议栈逐包开销；RPS 用软件把报文分发到不同 CPU；RFS 在此基础上尝试让报文靠近消费该流的应用线程。

<div class="note-flow"><span>NAPI 收包</span><i>→</i><span>GRO 合并报文</span><i>→</i><span>RPS 选择处理 CPU</span><i>→</i><span>RFS 参考 socket 所在 CPU</span><i>→</i><span>协议栈与应用处理</span></div>

这些机制会在吞吐、延迟和缓存局部性之间取舍。硬件 RSS 已合理分流时，额外 RPS 可能反而增加跨核队列与 IPI。

参考：[GRO、RFS、RPS 技术与调优](https://www.kerneltravel.net/blog/2020/network_ljr9/)
