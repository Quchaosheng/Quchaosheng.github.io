---
title: 伙伴系统与 SLUB：Linux 内核怎样分配内存
date: 2026-07-29 16:09:18
source_checked_at: 2026-07-29 16:09:18
permalink: /2026/07/29/linux-buddy-slub/
categories: [技术, Linux内核]
tags: [伙伴系统, SLUB, 内存分配]
---

Linux 内核用分层分配器解决不同粒度的需求：伙伴系统管理以页为单位的连续物理内存，SLUB 在这些页上高效分配频繁使用的小对象。

## 两层协作

伙伴系统按 2 的幂次组织空闲块。分配时拆分大块，释放时与同阶“伙伴”合并。SLUB 为相同类型或大小的对象建立 cache，把 slab 中的空闲槽直接交给调用者。

<div class="note-flow"><span>kmem_cache_alloc</span><i>→</i><span>从当前 slab 取对象</span><i>→</i><span>slab 不足</span><i>→</i><span>伙伴系统申请页</span><i>→</i><span>切分为对象槽</span></div>

## 记忆要点

- 伙伴系统减少外部碎片，但可能产生内部碎片。
- SLUB 复用已初始化布局，适合 `task_struct` 等内核对象。
- `kmalloc` 适合物理上连续的小块，`vmalloc` 虚拟连续但物理可分散。

参考：[不懂伙伴系统与 SLUB 分配器，别再说你懂 Linux 内核了](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494614&idx=1&sn=d4a6d3974c77eb269864ab6efd39ec40)
