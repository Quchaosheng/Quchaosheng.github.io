---
title: SPI NOR Flash：从 JEDEC ID 到通用驱动
date: 2026-06-27 14:00:00
permalink: /2026/07/29/spi-nor-sfud/
categories: [技术, 嵌入式]
tags: [SPI-NOR, SFUD, Flash]
---

SPI NOR Flash 的读写接口看起来只有几条命令，但可靠使用它需要理解器件约束。驱动先读取 JEDEC ID 和参数，确定容量、页大小、擦除粒度和支持的命令；写入时必须先写使能、按页编程、等待忙状态结束。真正的难点在上层如何应对跨页、擦除、掉电和寿命。

<div class="note-flow"><span>读取 JEDEC ID</span><i>→</i><span>解析器件参数</span><i>→</i><span>写使能</span><i>→</i><span>页编程/扇区擦除</span><i>→</i><span>轮询 WIP 并校验</span></div>

<figure class="note-visual"><figcaption><span>写入图</span>页编程和扇区擦除是两种粒度完全不同的操作。</figcaption><div class="note-map"><span><b>JEDEC ID</b><small>用于识别器件系列，不能只靠容量猜测参数。</small></span><span><b>SFDP/参数表</b><small>描述页大小、擦除命令、地址模式和时序能力。</small></span><span><b>WREN</b><small>写使能是一次性门槛，写后通常自动清除。</small></span><span><b>页编程</b><small>写入长度和起始地址必须拆分，不能跨越页边界。</small></span><span><b>扇区擦除</b><small>耗时长、影响范围大，必须避开唯一有效数据。</small></span><span><b>WIP 轮询</b><small>忙状态未结束前不能假定数据已经可靠可读。</small></span></div></figure>

## 页边界是最常见的数据损坏来源

页编程命令通常在页末尾回绕或忽略超出的部分，具体行为随芯片而不同。通用驱动应根据当前地址到页末的剩余空间拆分写入，随后轮询 WIP，并在需要时读回核对。不要把一个任意长度的缓冲区直接交给底层 page-program。

擦除在更大的扇区粒度发生，时间也比编程长得多。驱动接口应能报告忙、超时和擦除失败，上层则负责把有效记录搬到安全位置。掉电后能否恢复，取决于记录格式和提交顺序，不取决于 SPI 命令是否“返回成功”。

## 初始化时验证参数，运行时限制危险操作

读取 ID 后应验证容量、地址宽度和擦除命令是否符合预期。大容量芯片可能需要 4-byte 地址模式，混用 3-byte 地址会把数据写到错误位置。量产设备还要控制擦除和写入频率，避免诊断命令或异常重试不断磨损同一片区域。

参考：[SFUD](https://github.com/armink/SFUD)
