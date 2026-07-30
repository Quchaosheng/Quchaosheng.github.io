---
title: Page Cache：文件 I/O 为什么常常先经过内存
date: 2026-05-05 20:00:00
source_checked_at: 2026-07-29 17:36:41
permalink: /2026/07/29/linux-page-cache/
categories: [技术, Linux内核]
tags: [PageCache, 文件系统, I/O]
---

Page Cache 缓存文件内容页面。读文件时先查询缓存，命中就直接复制给用户态；未命中才从存储读取并填入缓存。写文件时通常先修改缓存页并标记为脏页，后台回写再把它们批量落盘。它让很多小 I/O 合并为更高效的存储访问，但也让“`write()` 返回成功”与“数据已经安全落盘”成为两件事。

<div class="note-flow"><span>read/write 系统调用</span><i>→</i><span>查询 Page Cache</span><i>→</i><span>命中直接访问</span><i>→</i><span>未命中读取磁盘</span><i>→</i><span>脏页后台回写</span></div>

<figure class="note-visual"><figcaption><span>缓存图</span>读路径追求命中，写路径需要区分“进入缓存”和“持久化完成”。</figcaption><div class="note-map"><span><b>address_space</b><small>文件的页缓存索引，连接 inode、缓存页和回写操作。</small></span><span><b>缓存命中</b><small>用户读到内存中的数据，不需要等待底层设备。</small></span><span><b>缺页读取</b><small>文件系统和块层把所需数据读入缓存，再唤醒等待者。</small></span><span><b>脏页</b><small>write 修改后的缓存数据，尚未保证已到达持久介质。</small></span><span><b>回写</b><small>内核按阈值和时机把脏页提交给文件系统和设备。</small></span><span><b>fsync</b><small>请求把相关数据及必要元数据推进到持久化语义边界。</small></span></div></figure>

## 缓存命中快，不代表应用没有排队

一个文件读得很快，可能只是数据刚好还在内存中；第一次冷读、内存压力下被回收后的再读，以及多个任务争抢同一块存储，表现都会不同。性能分析要区分缓存命中率、读放大、队列等待和实际设备延迟，不能只用一次 `cat` 的时间得出结论。

预读会在顺序访问时提前填充后续页面，随机访问则更依赖工作集是否留得住。不同访问模式可通过 `mmap`、普通 read、预读提示等路径表现出来，选择之前应先测工作负载而不是为“零拷贝”或“缓存绕过”贴标签。

## `fsync` 和 `O_DIRECT` 都有明确代价

`fsync` 用于需要更强持久化语义的场景，但频繁调用会增加提交压力。`O_DIRECT` 试图绕过页缓存，通常伴随地址、长度和偏移对齐要求，也可能与缓存读写交错造成一致性和性能问题。它们不是通用加速开关，应由数据丢失容忍度和真实 I/O 模式决定。

参考：[Page Cache 与 Buffer Cache](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247485247&idx=1&sn=4f0df0a72816b80bc1ff3415a8a9b0d1)
