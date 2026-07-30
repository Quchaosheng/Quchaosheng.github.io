---
title: sk_buff：Linux 网络包在内核中的旅行容器
date: 2026-07-29 13:10:00
categories: [技术, Linux内核]
tags: [sk_buff, 网络栈, Linux]
---

`sk_buff`（常称 skb）是 Linux 网络栈描述数据包的核心结构。它把包数据、协议头位置、设备、路由、校验和与时间戳等元数据组织在一起，并支持在各层之间传递。

## 收包路径

网卡 DMA 把数据写入接收缓冲区，驱动构造或关联 skb，NAPI 将它交给协议栈，随后依次经过链路层、网络层、传输层，最终进入 socket 接收队列。

<div class="note-flow"><span>网卡 DMA 收包</span><i>→</i><span>驱动准备 skb</span><i>→</i><span>NAPI/GRO</span><i>→</i><span>IP 与 TCP/UDP</span><i>→</i><span>Socket 接收队列</span></div>

## 记忆要点

- skb 主要是描述符，数据区可以克隆、分片或由多个片段组成。
- `head/data/tail/end` 描述线性区边界，协议层通过 push/pull 调整可见头部。
- 性能优化重点常在减少分配、复制和每包固定开销。

参考：[不懂 sk_buff，别再说你懂 Linux 内核了](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494680&idx=1&sn=99477ff5c398a2d6bb4dd59d3b3b6d71)
