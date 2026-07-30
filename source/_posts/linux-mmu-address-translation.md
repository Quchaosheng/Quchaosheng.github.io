---
title: MMU：虚拟地址如何找到物理内存
date: 2026-07-29 16:09:18
source_checked_at: 2026-07-29 16:09:18
permalink: /2026/07/29/linux-mmu-address-translation/
categories: [技术, Linux内核]
tags: [MMU, 页表, TLB, 内存管理]
---

CPU 执行程序时产生虚拟地址，MMU 根据页表把它翻译为物理地址。虚拟内存让每个进程拥有独立地址空间，也使权限隔离、按需分页和内存映射成为可能。

## 地址翻译

MMU 先查 TLB；命中时直接得到物理页框，未命中时遍历多级页表。页表项还保存读写、用户态、执行权限以及页面是否存在等状态。

<div class="note-flow"><span>CPU 产生虚拟地址</span><i>→</i><span>查询 TLB</span><i>→</i><span>遍历多级页表</span><i>→</i><span>组合物理地址</span><i>→</i><span>访问缓存或内存</span></div>

## 记忆要点

- TLB 缓存的是地址翻译，不是普通数据。
- 页越大，TLB 覆盖范围越大，但内部碎片也可能增加。
- 页表项无效或权限不符会触发缺页异常，由内核决定补页还是发送信号。

一句话回答：**MMU 在硬件中执行翻译，页表由操作系统建立，TLB 用来避免每次都走完整页表。**

参考：[不懂 MMU，别再说你懂 Linux 内核了](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494575&idx=1&sn=c6d2a9bfd8711a09643a02fd9d170872)
