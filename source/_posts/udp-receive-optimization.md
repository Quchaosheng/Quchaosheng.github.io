---
title: UDP 收包瓶颈：从网卡队列到应用线程
date: 2026-07-29 13:15:00
categories: [技术, Linux网络]
tags: [UDP, 网络性能, 调优]
---

UDP 没有重传与流控，丢包可能发生在网卡环形队列、软中断处理、socket 接收队列或应用读取阶段。优化必须先定位丢包层级，不能只盲目增大缓冲区。

## 数据路径

网卡 DMA 写入 RX ring，驱动通过 NAPI 构造 skb，协议栈查找 socket 并把报文排入接收队列，应用再由 `recvmsg` 等接口取走数据。

<div class="note-flow"><span>RX ring</span><i>→</i><span>NAPI/软中断</span><i>→</i><span>IP/UDP 处理</span><i>→</i><span>Socket 接收队列</span><i>→</i><span>应用批量读取</span></div>

## 优化顺序

- 先用网卡统计、`/proc/net/softnet_stat`、socket 丢包计数定位层级。
- 再考虑 RSS/RPS、IRQ 亲和性、增大 ring 与 socket buffer。
- 应用侧使用批量接口、减少复制和耗时处理，并建立背压或降级策略。

参考：[UDP 收包性能瓶颈与优化实践](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494405&idx=1&sn=2a2580b38f4a54404ca82748bb96d0b8)
