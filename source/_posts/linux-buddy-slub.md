---
title: 伙伴系统与 SLUB：Linux 内核怎样分配内存
date: 2026-04-07 20:00:00
source_checked_at: 2026-07-29 16:09:18
permalink: /2026/07/29/linux-buddy-slub/
categories: [技术, Linux内核]
tags: [伙伴系统, SLUB, 内存分配]
description: 串起页分配器、伙伴系统、SLUB、kmalloc 与 vmalloc，说明内核分配失败和碎片问题该如何观察。
---

内核既要分配整页和连续物理页，也要频繁创建几十到几千字节的小对象。只用一种分配器很难同时兼顾碎片、速度和对象复用，因此 Linux 将问题分层：页分配器管理物理页，伙伴系统组织可合并的连续页块，SLUB 再从页块中切出固定大小的对象槽。

## 从 order 到对象槽

伙伴系统按 order 管理空闲块：order 0 是一页，order 1 是两页，依次按 2 的幂增长。申请某个 order 时，若该链表没有空闲块，可以拆分更高 order；释放时，只有地址对齐且同阶空闲的伙伴才能合并。它能快速拆分和合并，但不能保证系统运行很久后仍能满足高阶连续分配。

SLUB 为同类对象建立 `kmem_cache`。每个 slab 由一组页面组成，内部保存已经分割好的对象槽。快速路径尽量从当前 CPU 的 slab 取对象，减少全局锁争用；槽不足时才向页分配器申请新的 slab。

<div class="note-flow"><span>kmem_cache_alloc</span><i>→</i><span>从当前 slab 取对象</span><i>→</i><span>slab 不足</span><i>→</i><span>伙伴系统申请页</span><i>→</i><span>切分为对象槽</span></div>

<div class="note-map"><span><b>伙伴系统</b><small>管理 2 的幂次连续物理页</small></span><span><b>SLUB cache</b><small>按对象类型或大小复用 slab</small></span><span><b>kmalloc</b><small>小块内存，物理上连续</small></span><span><b>vmalloc</b><small>虚拟连续，物理页可以分散</small></span><span><b>GFP 标志</b><small>描述可否睡眠、可用区域与回收约束</small></span><span><b>memcg/NUMA</b><small>配额和节点位置也影响分配结果</small></span></div>

## kmalloc、kmem_cache 与 vmalloc

- `kmalloc()` 适合通用的小块分配，返回物理连续、虚拟连续的内存；过大的连续申请更容易受碎片影响。
- `kmem_cache_create()` 适合大量同构对象，可配置对齐、构造和调试能力。
- `vmalloc()` 只保证虚拟地址连续，页表建立和 TLB 压力更高，也不适合要求物理连续的 DMA 场景。
- DMA 缓冲区应使用对应 DMA API，不能因为 `kmalloc` 物理连续就绕过设备地址、缓存一致性和掩码约束。

## 用系统接口观察

```bash
cat /proc/buddyinfo
head -n 20 /proc/slabinfo
grep -E 'Slab|SReclaimable|SUnreclaim|Vmalloc' /proc/meminfo
slabtop -o
```

`/proc/buddyinfo` 中高 order 数量很少，只能说明当前各 zone 的空闲块分布，不能单独断定已经发生不可恢复的碎片。还要结合分配 order、GFP 标志、zone、水位、回收与规整日志判断。`slabtop` 展示对象 cache 的当前统计，也不能直接证明某个 cache 泄漏；对象数量增长可能来自正常负载或缓存策略。

## 分配失败时的检查顺序

1. 从日志确认失败的 order、GFP mask、调用栈和 NUMA/zone 约束。
2. 区分“总内存不足”和“有空闲页但缺少满足条件的连续块”。
3. 检查调用上下文能否睡眠，是否错误使用了原子分配标志。
4. 对长期大块需求，优先在设计上避免运行期高阶分配，或评估 CMA、预留池和 scatter-gather。

## 证据边界

不同内核版本、NUMA 拓扑、页大小和 SLAB 实现会改变统计字段与快速路径。本文给出的是排查框架；生产结论应保存内核版本、配置、分配栈和当时的内存状态。

参考：[Physical Memory](https://docs.kernel.org/mm/physical_memory.html) · [Slab Allocation](https://docs.kernel.org/mm/slab.html) · [Memory Allocation Guide](https://docs.kernel.org/core-api/memory-allocation.html) · [不懂伙伴系统与 SLUB 分配器，别再说你懂 Linux 内核了](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494614&idx=1&sn=d4a6d3974c77eb269864ab6efd39ec40)
