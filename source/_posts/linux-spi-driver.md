---
title: Linux SPI 驱动：控制器、设备与传输
date: 2026-07-29 13:17:00
categories: [技术, 嵌入式Linux]
tags: [SPI, 设备驱动, 设备树]
---

Linux SPI 子系统把硬件控制器与具体外设驱动分开。控制器驱动负责时钟、FIFO、DMA 和片选，协议驱动只描述外设需要怎样组织消息与解析数据。

## 一次传输

设备树创建 `spi_device`，匹配到 `spi_driver` 后执行 probe。协议驱动构造一个或多个 `spi_transfer`，组合成 `spi_message` 提交给控制器。

<div class="note-flow"><span>设备树描述外设</span><i>→</i><span>总线匹配并 probe</span><i>→</i><span>构造 transfer/message</span><i>→</i><span>控制器驱动执行</span><i>→</i><span>中断或 DMA 完成</span></div>

## 记忆要点

- SPI 是全双工时钟同步总线，没有统一的上层寄存器协议。
- mode 决定 CPOL/CPHA，频率和 bits-per-word 也必须匹配器件。
- 多段 transfer 可控制片选是否保持，避免破坏器件事务边界。

参考：[不懂 Linux SPI 驱动，看完这篇就明白了](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247495151&idx=1&sn=ba206a324d615ef3bd6eafdca8c558bc)
