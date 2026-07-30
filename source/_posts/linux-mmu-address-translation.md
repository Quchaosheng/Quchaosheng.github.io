---
title: MMU：虚拟地址如何找到物理内存
date: 2026-04-03 10:00:00
source_checked_at: 2026-07-29 16:09:18
permalink: /2026/07/29/linux-mmu-address-translation/
categories: [技术, Linux内核]
tags: [MMU, 页表, TLB, 内存管理]
description: 从虚拟地址拆分、TLB、多级页表和缺页异常出发，解释 MMU 翻译路径及其可观测边界。
---

用户程序看到的是虚拟地址。MMU 按操作系统建立的页表把虚拟页映射到物理页框，同时检查用户/内核、读/写和可执行权限。这样每个进程可以拥有独立地址空间，同一物理页也能被多个地址空间共享。地址翻译主要由硬件完成，但页表内容、缺页处理和映射生命周期由内核管理。

## 地址怎样被拆开

以多级页表为例，虚拟地址被拆成多级索引和页内偏移。每一级页表项指向下一级表，最后一级给出物理页框号和权限位。最终物理地址由页框基址与页内偏移组合而成。具体级数、位宽和大页形式由架构与内核配置决定，不能把 x86-64 的字段直接套到 ARM64 或 RISC-V。

<div class="note-flow"><span>CPU 产生虚拟地址</span><i>→</i><span>查询 TLB</span><i>→</i><span>遍历多级页表</span><i>→</i><span>组合物理地址</span><i>→</i><span>访问缓存或内存</span></div>

<div class="note-map"><span><b>虚拟页号</b><small>多级页表索引的来源</small></span><span><b>页内偏移</b><small>翻译前后保持不变</small></span><span><b>页表项</b><small>页框、权限、存在与状态位</small></span><span><b>TLB</b><small>缓存最近使用的翻译结果</small></span><span><b>ASID/PCID</b><small>帮助区分地址空间，减少无谓刷新</small></span><span><b>缺页异常</b><small>把无法完成的访问交回内核判断</small></span></div>

## TLB 命中与页表遍历

MMU 先查询 TLB。命中后可以直接得到页框和权限；未命中时，硬件通常发起页表遍历，并把成功结果填入 TLB。页表遍历本身也要读取内存，所以处理器会使用专门缓存和并行机制减小代价。TLB shootdown 则发生在映射或权限变化后：其他 CPU 上可能缓存了旧翻译，内核需要让相关条目失效。

TLB miss 与 page fault 不是同一件事。前者可能在硬件遍历成功后悄无声息地结束；只有页表项不存在、权限不符或架构定义的其他异常条件出现时，CPU 才进入缺页异常处理。

## 在 Linux 上观察映射

`/proc/<pid>/maps` 展示 VMA，`smaps` 提供更细的驻留和共享统计。它们描述的是内核视角的映射与内存记账，不直接展示每次硬件页表遍历。

```bash
pid=$$
head -n 20 /proc/$pid/maps
sed -n '1,35p' /proc/$pid/smaps
perf stat -e page-faults,minor-faults,major-faults -- ./your_app
```

若要读取 `/proc/<pid>/pagemap` 或物理页框信息，还会受到权限和内核安全策略限制。即便拿到页表相关数据，也不能据此推断某一时刻的 TLB 内容。

## 大页为什么不是免费加速

大页能用一个 TLB 条目覆盖更多内存，并减少页表层级和页表内存，但可能增加内部碎片、内存规整和分配失败风险。Transparent Huge Pages 是否有益取决于工作集、访问模式与延迟目标，应结合 `smaps`、缺页延迟和业务指标验证。

## 证据边界

本文使用架构无关的概念解释流程，没有给出固定页表级数、TLB 容量或访问周期。分析具体机器时必须结合架构手册、内核配置、页大小和性能计数器。

参考：[Linux page tables](https://docs.kernel.org/mm/page_tables.html) · [Examining process page tables](https://docs.kernel.org/admin-guide/mm/pagemap.html) · [不懂 MMU，别再说你懂 Linux 内核了](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494575&idx=1&sn=c6d2a9bfd8711a09643a02fd9d170872)
