---
title: alloc_pages：物理页面分配如何走到伙伴系统
date: 2026-07-29 14:02:00
categories: [技术, Linux内核]
tags: [alloc_pages, 伙伴系统, GFP]
---

`alloc_pages` 根据 GFP 标志、order、NUMA 策略和水位线选择 zone，再尝试 per-CPU page list 与伙伴系统；快路径失败后可能进入回收、规整或 OOM 路径。

<div class="note-flow"><span>提交 GFP/order 请求</span><i>→</i><span>选择 zonelist</span><i>→</i><span>检查水位线与 PCP</span><i>→</i><span>伙伴系统取页</span><i>→</i><span>必要时回收/规整/重试</span></div>

order 越高越容易受碎片影响；原子上下文不能触发睡眠回收。理解 GFP 语义比机械记忆函数调用更重要。

参考：[alloc_page 分配内存](https://www.kerneltravel.net/blog/2021/alloc_page_zzp/)
