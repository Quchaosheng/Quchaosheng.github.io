---
title: Page Cache：文件 I/O 为什么常常先经过内存
date: 2026-06-28 20:20:00
permalink: /2026/07/29/linux-page-cache/
categories: [技术, Linux内核]
tags: [PageCache, 文件系统, I/O]
---

Page Cache 缓存文件内容页面。读文件时优先命中缓存；写文件时通常先写脏页，再由回写机制异步落盘，从而合并 I/O 并提升吞吐。

<div class="note-flow"><span>read/write 系统调用</span><i>→</i><span>查询 Page Cache</span><i>→</i><span>命中直接访问</span><i>→</i><span>未命中读取磁盘</span><i>→</i><span>脏页后台回写</span></div>

buffer cache 是历史概念；现代 Linux 大量文件缓存统一由 page cache 管理。`fsync` 影响持久化语义，`O_DIRECT` 则试图绕过页缓存但有对齐和性能权衡。

参考：[Page Cache 与 Buffer Cache](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247485247&idx=1&sn=4f0df0a72816b80bc1ff3415a8a9b0d1)
