---
title: CMA：为大块连续物理内存保留弹性空间
date: 2026-07-29 14:07:00
categories: [技术, 嵌入式Linux]
tags: [CMA, 内存规整, DMA]
---

CMA 预留一段可迁移页面区域，平时可供普通可移动页使用；设备需要大块连续物理内存时，内核迁走其中普通页面并回收连续范围。

<div class="note-flow"><span>启动时建立 CMA 区域</span><i>→</i><span>普通可移动页临时使用</span><i>→</i><span>设备请求连续内存</span><i>→</i><span>迁移占用页面并规整</span><i>→</i><span>返回连续页块</span></div>

CMA 适合显示、视频和大型 DMA 缓冲区。不可迁移页进入 CMA 或内存严重碎片化会导致分配失败，需结合 reserved-memory 和统计调优。

参考：[CMA 机制](https://www.kerneltravel.net/blog/2020/hds_cma_20201008/)
