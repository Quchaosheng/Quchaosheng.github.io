---
title: DMA：设备怎样绕过 CPU 搬运大块数据
date: 2026-07-29 13:39:00
categories: [技术, 嵌入式Linux]
tags: [DMA, 设备驱动, 缓存一致性]
---

DMA 让设备直接读写内存，CPU 只负责准备缓冲区、填写描述符、启动传输并处理完成事件。它能显著减少逐字节 copy 的 CPU 消耗，但也带来三个必须明确的概念：CPU 虚拟地址、物理地址与设备看到的 DMA 地址不一定相同；CPU cache 与设备 DMA 是否一致取决于平台；缓冲区在设备和 CPU 之间交接时必须有清晰所有权与生命周期。

<div class="note-flow"><span>驱动映射缓冲区</span><i>→</i><span>配置 DMA 描述符</span><i>→</i><span>设备读写内存</span><i>→</i><span>DMA 完成中断</span><i>→</i><span>驱动解除映射并处理数据</span></div>

## 不要把普通指针直接写进寄存器

CPU 虚拟地址只对当前内核地址空间有意义；物理地址描述 RAM 位置；DMA 地址是设备通过总线/IOMMU 实际使用的地址。它们在简单平台上可能恰好相同，但驱动必须使用 DMA mapping API，让内核处理 IOMMU、地址掩码、bounce buffer 与架构差异。

<div class="note-map"><span><b>CPU virtual address</b><small>内核 C 指针可访问的地址，不能直接交给设备</small></span><span><b>physical address</b><small>RAM 物理位置，未必等于设备可访问的总线地址</small></span><span><b>DMA address</b><small>设备编程到描述符中的地址，由 DMA API 返回</small></span><span><b>coherent DMA</b><small>CPU/设备视图保持一致，适合描述符，但仍需同步所有权</small></span><span><b>streaming DMA</b><small>映射一次传输，CPU/设备交接时要做 cache 同步</small></span><span><b>IOMMU</b><small>将设备 DMA 地址翻译/隔离，增加安全性但不能绕过 API</small></span></div>

## coherent 和 streaming 的使用边界

`dma_alloc_coherent()` 分配 CPU 与设备一致可见的缓冲，常用于频繁访问的小型描述符环；streaming mapping 使用 `dma_map_single()`/`dma_unmap_single()` 或 sg 版本，适合一次或一批数据传输。对于非一致 cache 架构，CPU 在交给设备前和从设备收回后还要用同步 API，方向必须正确。

```c
dma_addr_t dma = dma_map_single(dev, buf, len, DMA_TO_DEVICE);
if (dma_mapping_error(dev, dma)) return -EIO;

start_device_dma(dev, dma, len);
/* 完成回调后：确认设备不再使用该 buffer */
dma_unmap_single(dev, dma, len, DMA_TO_DEVICE);
```

示例省略了锁、错误恢复和异步所有权。关键规则是：映射后到 unmap 前，buffer 的访问权已交给设备；CPU 若要重新读写，必须遵循对应的同步/完成顺序。

## DMA bug 为什么常常“只在某些板子上出现”

x86 等一致性较强的平台可能掩盖缺失 cache 同步的问题，而 ARM/RISC-V 非一致系统会立即暴露旧数据或损坏。IOMMU 开启后，错误地址可能变成 fault；高负载时，提前复用 buffer 可能偶发覆盖。将 DMA API 当作可移植性和正确性契约，而不是性能障碍，能避免很多只在客户硬件复现的错误。

调试时记录 DMA direction、长度、地址掩码、映射/解除映射时刻、完成中断和 buffer 所有者；必要时开启 DMA API debug。DMA 的难点不是启动一次传输，而是保证设备永远不会读写一个已被 CPU 重用或已经释放的缓冲区。

参考：[Dynamic DMA mapping Guide](https://docs.kernel.org/core-api/dma-api.html) · [DMA API HOWTO](https://docs.kernel.org/core-api/dma-api-howto.html)
