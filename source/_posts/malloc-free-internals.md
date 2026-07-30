---
title: malloc 与 free：用户态分配器如何管理堆内存
date: 2026-07-29 13:23:00
categories: [技术, C-C++]
tags: [malloc, free, 堆, 内存分配]
---

`malloc()` 通常不会为每次请求都进入内核。用户态分配器先从已管理的 arena、空闲链表或线程缓存中寻找合适内存块，库存不足时才通过 `brk`、`mmap` 等方式扩展可用虚拟内存。

## 分配与释放

分配器会在用户数据附近或独立结构中保存块大小、状态等元数据。`free(ptr)` 根据指针定位这些元数据，因此调用者不必再次传入大小；随后内存块进入缓存或空闲结构，必要时与相邻块合并。

<div class="note-flow"><span>malloc 收到大小请求</span><i>→</i><span>映射到 size class</span><i>→</i><span>从线程缓存或 arena 取块</span><i>→</i><span>记录元数据并返回</span><i>→</i><span>free 后缓存、合并或归还</span></div>

## 常见误区

- `free()` 知道块大小，不代表它知道对象的 C++ 类型。
- 释放后内存通常只是回到分配器，不一定立即归还操作系统。
- 越界写可能破坏分配器元数据，使崩溃发生在后续无关的 malloc/free 中。
- double free、use-after-free 和分配释放接口不配对都属于未定义行为。

一句话回答：**free 依靠分配器保存的块元数据确定大小，堆分配的额外成本来自查找、记账、碎片和并发管理。**

参考：[malloc 是如何分配内存的，free 怎么知道该释放多少内存？](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247489489&idx=1&sn=fa5bc45a29be5ad77ea8a1be6da55cbb)
