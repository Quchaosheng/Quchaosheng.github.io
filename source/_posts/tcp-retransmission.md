---
title: TCP 重传：可靠传输如何发现并修复丢包
date: 2026-07-29 13:14:00
categories: [技术, Linux网络]
tags: [TCP, 重传, 拥塞控制]
---

TCP 通过序列号、累计确认和重传恢复丢失的数据。触发重传主要有两条路径：重传超时（RTO）与基于重复 ACK/SACK 的快速重传。

## 丢包恢复

发送端维护未确认数据和 RTT 估计。超时说明长时间未获确认；收到足够的丢包证据时则不必等到超时，可提前重传。SACK 能指出接收端已拥有的非连续区间，减少无谓重发。

<div class="note-flow"><span>发送带序列号的数据</span><i>→</i><span>接收端返回 ACK/SACK</span><i>→</i><span>识别缺口或超时</span><i>→</i><span>重传丢失段</span><i>→</i><span>调整拥塞窗口</span></div>

## 记忆要点

- RTO 根据平滑 RTT 和抖动动态计算，不能固定不变。
- 重传既是可靠性机制，也会影响拥塞控制状态。
- 重复 ACK 不必然代表丢包，也可能来自乱序，SACK 提供更精确信息。

参考：[深度拆解 TCP 重传机制，看透可靠传输底层逻辑](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494937&idx=1&sn=53019c5796c4a886615480acf905e81a)
