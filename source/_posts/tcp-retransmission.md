---
title: TCP 重传：可靠传输如何发现并修复丢包
date: 2026-06-20 20:20:00
permalink: /2026/07/29/tcp-retransmission/
categories: [技术, Linux网络]
tags: [TCP, 重传, 拥塞控制]
---

TCP 的可靠性不是“发一遍没到就再发一遍”这么简单。发送端为每段数据分配序列号并保留未确认数据；接收端通过累计 ACK 和 SACK 告诉发送端哪些字节已到达、哪里存在缺口；发送端依据 RTT 估计、重复 ACK、SACK 和记分板判断是否丢包，并在合适的时机重传。重传既恢复可靠性，也会触发拥塞控制，因此它会直接改变吞吐、延迟和连接状态。

<div class="note-flow"><span>发送带序列号的数据</span><i>→</i><span>接收端返回 ACK/SACK</span><i>→</i><span>识别缺口或超时</span><i>→</i><span>重传丢失段</span><i>→</i><span>调整拥塞窗口</span></div>

## 两条主要的丢包发现路径

**重传超时（RTO）**：某段数据长时间未被确认，发送端认为它可能丢失，触发超时重传。这条路径保守但代价高，因为等待超时会增加尾延迟。

**快速重传/基于 SACK 的恢复**：接收端持续确认更高序列号的数据，却反复暴露中间缺口，发送端可以在 RTO 前推断丢失段并重传。SACK 能精确描述已收到的非连续区间，避免把已经到达的段重复发送。

<div class="note-map"><span><b>序列号</b><small>把字节流位置编号，发送端据此追踪未确认数据</small></span><span><b>累计 ACK</b><small>确认连续前缀；出现缺口时会反复指向同一位置</small></span><span><b>SACK</b><small>补充已到达的非连续范围，帮助精准恢复</small></span><span><b>RTT/RTO</b><small>根据往返时延及其抖动估计超时，不应固定常数</small></span><span><b>快速恢复</b><small>尽早重传疑似丢失段，避免等待 RTO</small></span><span><b>拥塞控制</b><small>丢包通常被视为拥塞信号，会影响拥塞窗口与发送速率</small></span></div>

## 重传不一定意味着链路真的丢了包

乱序、ACK 延迟、对端 CPU 忙、接收窗口受限、队列积压或中间设备重排都可能导致类似现象。TCP 的恢复算法会综合多种证据，但应用排障不能看到“Retrans”就立刻换网卡。应结合 RTT、cwnd、rttvar、对端处理时间、网卡/softnet 丢包计数和抓包时间戳判断。

```bash
ss -ti dst <peer-ip>
nstat -az | grep -i retrans
tcpdump -i eth0 -nn -ttt host <peer-ip>
```

`ss -ti` 适合查看连接级状态，`nstat` 适合系统计数变化，抓包则能看线上的 ACK/SACK 和乱序现象。抓包本身也有丢包/时间戳误差，必要时使用硬件时间戳或多点采集。

## 对实时业务意味着什么

TCP 为可靠性引入的排队、拥塞窗口和重传时间，天然与“每个状态必须在 10 ms 内有用”存在冲突。控制/状态类协议要明确 deadline：过期状态重传回来时，应用是否仍应执行？很多实时系统会将关键控制放在带序号/时间戳的 UDP 或现场总线之上，将 TCP 留给配置、日志、文件与可靠命令通道。

无论使用哪种协议，都应把“发送成功”“内核确认”“对端收到”“对端业务处理完成”区分开。TCP 保障字节流可靠到达，不替代业务层的时效性与幂等性设计。

参考：[TCP(7)](https://man7.org/linux/man-pages/man7/tcp.7.html) · [TCP loss recovery](https://www.rfc-editor.org/rfc/rfc5681)
