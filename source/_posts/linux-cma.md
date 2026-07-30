---
title: CMA：为大块连续物理内存保留弹性空间
date: 2026-04-13 20:00:00
permalink: /2026/07/29/linux-cma/
categories: [技术, 嵌入式Linux]
tags: [CMA, 内存规整, DMA]
---

显示、摄像头、视频编解码和某些 DMA 设备常需要大块连续物理内存。系统运行一段时间后，即使总空闲内存很多，伙伴系统也可能因碎片找不到足够大的连续块。CMA（Contiguous Memory Allocator）在启动时保留一片可迁移区域：平时可临时给普通可移动页使用；当设备需要连续内存时，内核尝试迁走其中页面并整理出连续范围。这比永久独占一大块 reserved memory 更灵活，但不是无条件成功。

<div class="note-flow"><span>启动时建立 CMA 区域</span><i>→</i><span>普通可移动页临时使用</span><i>→</i><span>设备请求连续内存</span><i>→</i><span>迁移占用页面并规整</span><i>→</i><span>返回连续页块</span></div>

## CMA 与普通伙伴分配的差别

普通高阶分配依赖此刻恰有连续 free pages；CMA 则先在指定区域中尝试把可迁移页面迁走，再形成连续块。因此 CMA 的成功率依赖该区域中是否混入不可迁移/长时间 pin 住的页面、迁移是否允许，以及系统当前的内存压力。它不是“一定分配得到”的硬预留。

<div class="note-map"><span><b>启动保留</b><small>通过内核参数或 reserved-memory 建立候选连续区域</small></span><span><b>平时复用</b><small>可移动页可暂用 CMA，提升整体内存利用率</small></span><span><b>需要大块时</b><small>内核迁移可移动页并规整，尝试凑出连续范围</small></span><span><b>失败原因</b><small>不可迁移页、长期 pin、内存压力、区域太小或地址限制</small></span><span><b>典型设备</b><small>显示、摄像头、VPU/GPU、连续 DMA 缓冲</small></span><span><b>替代方案</b><small>固定 reserved memory、IOMMU/SG、预分配或改变缓冲策略</small></span></div>

## 区域大小和位置如何决定

CMA 大小应从真实的峰值帧缓冲、并发摄像头、编解码器工作集与安全余量推导，而不是简单“内存越大越好”。太小会在高分辨率/并发时失败，太大则降低普通内存可用性。某些设备还有 DMA 地址位宽限制，因此 CMA 区域的位置必须落在设备可访问范围；设备树 `reserved-memory` 与相关节点属性能表达板级约束。

```bash
grep -E 'Cma(Total|Free)' /proc/meminfo
dmesg | grep -i -E 'cma|contiguous'
```

这些数据有助于观察区域是否存在、可用空间是否持续下降以及分配失败是否与 CMA 有关。还应结合驱动日志记录每次请求的大小、时机和失败原因。

## 何时不应该依赖 CMA

如果设备对“每次都必须成功”的大块缓冲有硬要求，且系统存在不可控内存压力或第三方驱动 pin 页，单靠 CMA 风险很高。应考虑启动时固定预分配、专用 reserved memory、通过 IOMMU/scatter-gather 消除物理连续要求，或限制并发工作集。实时视频路径也应在启动/模式切换时分配缓冲，避免在关键帧期间触发迁移和规整。

CMA 是在内存利用率与连续性之间做弹性折中。用它之前先确定设备真实需要“物理连续”还是只需要“DMA 可访问”，这两个需求对应的设计空间完全不同。

参考：[Contiguous Memory Allocator](https://docs.kernel.org/admin-guide/mm/cma.html) · [reserved-memory bindings](https://docs.kernel.org/devicetree/bindings/reserved-memory/reserved-memory.html)
