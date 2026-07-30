---
title: sk_buff：Linux 网络包在内核中的旅行容器
date: 2026-04-10 14:00:00
permalink: /2026/07/29/linux-sk-buff/
categories: [技术, Linux内核]
tags: [sk_buff, 网络栈, Linux]
---

`struct sk_buff`，通常简称 skb，是 Linux 网络栈用来描述一个包及其元数据的核心对象。它不只是“装数据的数组”：其中包含数据区边界、协议头偏移、设备、路由、校验和、时间戳、socket 所有权和引用计数等信息。理解 skb 的关键不是背字段，而是理解数据本体、元数据、所有权和协议层如何在不必要复制的前提下向前推进。

<div class="note-flow"><span>网卡 DMA 收包</span><i>→</i><span>驱动准备 skb</span><i>→</i><span>NAPI/GRO</span><i>→</i><span>IP 与 TCP/UDP</span><i>→</i><span>Socket 接收队列</span></div>

## 线性数据区怎样被各层使用

skb 的线性 head buffer 通常包含可操作的头部和部分 payload，`head`、`data`、`tail`、`end` 描述其边界。驱动/上层会预留头部空间；当协议栈向下封装时可通过 `skb_push()` 在 `data` 前放入新头部，向上解析时用 `skb_pull()` 越过已处理的头部。真正修改前必须确认可写和空间足够。

<div class="note-map"><span><b>head/data/tail/end</b><small>描述线性缓冲区的起点、可见数据、已用末尾与容量末尾</small></span><span><b>headroom</b><small>data 之前的预留空间，供下层添加 Ethernet/IP 等头部</small></span><span><b>tailroom</b><small>tail 到 end 的空间，供追加数据或协议尾部</small></span><span><b>frags</b><small>非线性页片段，允许大包/DMA 避免全部复制到线性区</small></span><span><b>clone</b><small>多个 skb 可共享数据，需要写时确认独占性与引用计数</small></span><span><b>metadata</b><small>协议头指针、checksum、时间戳、device、route 等伴随信息</small></span></div>

## 克隆、分片和所有权是 bug 高发区

`skb_clone()` 可以复制描述符而共享底层数据，适合镜像、转发或多消费者路径；但克隆后直接改数据可能影响其他引用，通常要先确保可写。GRO/GSO、scatter-gather DMA 还会让 skb 带有页片段，不再是“所有数据都连续在 `data` 后面”。驱动和协议代码不能假设 `skb->len` 对应一段连续内存。

```text
收到 skb -> 检查长度/线性化需求 -> 解析或调整 header
        -> 若需修改共享数据：确保可写
        -> 传给下一层时转移所有权
        -> 错误路径只释放自己仍拥有的引用
```

最常见问题包括重复释放、错误地在克隆数据上写入、没有检查 header 是否跨 fragment、硬件 DMA 完成前就重用缓冲区。它们往往只在高 PPS、GRO 开启或异常重传时暴露。

## 性能优化为何常常绕不开 skb

每包分配、复制、cache miss 和引用计数都会累积成 CPU 成本。NAPI page pool、GRO、checksum/GSO offload 和 XDP 都在不同阶段试图减少 skb 创建或每包固定开销。优化时必须保持正确的所有权与生命周期：少一次 copy 很好，但把未同步的 DMA 缓冲交给用户态或错误复用，会换来更难排查的数据损坏。

抓问题时结合 `skb:kfree_skb` tracepoint、驱动统计、协议栈 tracepoint 与应用丢包计数。先确认一个包由谁拥有、何时释放、是否线性，通常比直接在 skb 字段里迷路更有效。

参考：[sk_buff documentation](https://docs.kernel.org/networking/skbuff.html) · [Linux networking](https://docs.kernel.org/networking/index.html)
