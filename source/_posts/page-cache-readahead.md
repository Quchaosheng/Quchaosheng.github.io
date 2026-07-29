---
title: Page Cache 预读：内核如何提前猜中下一次读取
date: 2026-07-29 14:01:00
categories: [技术, Linux内核]
tags: [PageCache, 预读, 文件系统]
---

顺序读文件时，内核会根据访问历史扩大预读窗口，提前把后续页面送入 Page Cache；随机访问则会抑制预读，避免浪费 I/O 与内存。

<div class="note-flow"><span>读取页面未命中</span><i>→</i><span>识别顺序访问模式</span><i>→</i><span>提交异步预读</span><i>→</i><span>磁盘批量读取</span><i>→</i><span>后续 read 命中缓存</span></div>

可结合 `mincore`、ftrace、块层统计和缺页计数观察效果。预读不是越大越好，窗口过大会挤压有效缓存并增加无用读。

参考：[Linux 内核中跟踪文件页缓存预读](https://www.kerneltravel.net/blog/2021/debug_pagecache_szp/)
