---
title: alloc_pages：物理页面分配如何走到伙伴系统
date: 2026-07-06 20:20:00
permalink: /2026/07/29/alloc-pages-path/
categories: [技术, Linux内核]
tags: [alloc_pages, 伙伴系统, GFP]
---

`alloc_pages()` 看上去只是申请若干物理页，实际调用把“我在什么上下文、能否等待、需要什么内存区域、是否必须连续、失败可否重试”交给内存管理子系统。内核会依据 GFP 标志、NUMA 策略、zone 水位线和 order 选择候选区域，先走 per-CPU page list（PCP）与伙伴系统快路径；资源紧张时才进入回收、规整、重试甚至 OOM 的慢路径。

<div class="note-flow"><span>提交 GFP/order 请求</span><i>→</i><span>选择 zonelist</span><i>→</i><span>检查水位线与 PCP</span><i>→</i><span>伙伴系统取页</span><i>→</i><span>必要时回收/规整/重试</span></div>

## GFP 与 order 描述的不是“大小”而已

`order` 表示需要 `2^order` 个连续基础页。order 越高，越容易被长期碎片化阻挡；即使系统剩余内存很多，也可能找不到一大块连续页面。GFP 标志则描述分配语义，例如调用方是否允许睡眠和回收、偏好哪个 zone、是否需要清零或特定迁移类型。

<div class="note-map"><span><b>GFP_KERNEL</b><small>普通进程上下文常用；允许睡眠、回收和较长路径</small></span><span><b>GFP_ATOMIC</b><small>原子上下文使用；不能睡眠，依赖保留资源，失败概率更高</small></span><span><b>order</b><small>连续页数量为 2^order，越大越易受外部碎片影响</small></span><span><b>zone/NUMA</b><small>地址能力与内存节点决定可选的页来源</small></span><span><b>PCP</b><small>每 CPU 页缓存加速小页分配，减少全局锁竞争</small></span><span><b>slow path</b><small>回收、规整、重试和 OOM 可能造成明显延迟</small></span></div>

```c
struct page *p1 = alloc_pages(GFP_KERNEL, 0);  /* 可睡眠上下文的一页 */
struct page *p2 = alloc_pages(GFP_ATOMIC, 0);  /* 中断/原子路径，必须能接受失败 */
```

第二个调用不是“更快版的分配”，而是“不能等待版的分配”。若它失败，调用者必须有退化逻辑，例如使用预分配池、丢弃可丢事件或推迟到可睡眠 worker；不能在原子上下文里硬等内存回来。

## 伙伴系统为什么会碎片化

伙伴系统以 2 的幂次管理连续块，释放时若相邻 buddy 也空闲就合并。长期运行后，不同生命周期的页面交织在一起，大块被小块切碎；内核可尝试内存规整，将可迁移页面挪开以凑出连续区，但规整和回收都不是免费且可预测的操作。

驱动需要大块 DMA 缓冲时，应优先考虑 CMA、预留内存、IOMMU 或分段设计，而不是在系统运行很久后临时申请高阶页。对实时路径而言，最好的高阶分配通常是启动阶段已经完成的分配。

## 排障时该看什么

观察分配失败时的 GFP mask、order、调用上下文、zone 水位线和内存碎片信息。不要只用“free 内存还有很多”判断原因。若问题与特定 NUMA 节点、DMA zone 或长时间运行相关，布局与生命周期往往比简单增大内存更重要。

参考：[Memory Allocation Guide](https://docs.kernel.org/core-api/memory-allocation.html) · [The Buddy Allocator](https://docs.kernel.org/mm/physical_memory.html)
