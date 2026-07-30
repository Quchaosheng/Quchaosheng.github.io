---
title: TSN：以太网怎样提供确定性时延
date: 2026-07-30 09:09:00
categories: [技术, Linux实时]
tags: [TSN, 确定性网络, PTP]
---

TSN 通过统一时间、流量整形、门控队列、优先级和冗余机制，使关键流在共享以太网上获得可计算的发送窗口与时延上界。

<div class="note-flow"><span>PTP 同步全网时间</span><i>→</i><span>识别关键业务流</span><i>→</i><span>配置队列与 Gate Control List</span><i>→</i><span>按时间窗发送</span><i>→</i><span>监控延迟、丢包与时钟偏差</span></div>

确定性来自端到端配置，单独启用某个 qdisc 并不足够；交换机和网卡也必须支持对应标准。参考：[Linux TSN](https://tsn.readthedocs.io/)
