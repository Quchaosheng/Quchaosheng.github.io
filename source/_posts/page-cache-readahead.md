---
title: Page Cache 预读：内核如何提前猜中下一次读取
date: 2026-05-26 14:00:00
permalink: /2026/07/29/page-cache-readahead/
categories: [技术, Linux内核]
tags: [PageCache, 预读, 文件系统]
---

读取文件并不总是马上访问磁盘。Linux 先在 Page Cache 中查找页面：命中时数据直接从内存复制给应用；未命中时才向文件系统和块层发起 I/O。预读（readahead）利用“顺序读的下一个页面很可能也会被读”的规律，提前把未来页面异步放进 Page Cache，把一次次小 I/O 合成更高效的批量读取。

<div class="note-flow"><span>读取页面未命中</span><i>→</i><span>识别顺序访问模式</span><i>→</i><span>提交异步预读</span><i>→</i><span>磁盘批量读取</span><i>→</i><span>后续 read 命中缓存</span></div>

## 命中、缺页与预读不是同一件事

普通 `read()` 会主动把数据复制到用户缓冲区，Page Cache miss 会触发文件 I/O；`mmap()` 则在进程真正访问映射页时可能产生缺页。两种路径都可受缓存和预读影响，但观测指标不同。预读的目标是让真正需要的数据到来之前已经在缓存中，而不是单纯增加内存占用。

<div class="note-map"><span><b>Page Cache hit</b><small>所需页面已在内存，读取不等待块设备</small></span><span><b>Page Cache miss</b><small>需要向文件系统/块层发起 I/O，应用可能等待</small></span><span><b>顺序模式</b><small>内核可扩大预读窗口，提高后续命中率</small></span><span><b>随机模式</b><small>预读会被抑制，避免无用数据挤掉有效缓存</small></span><span><b>mmap 缺页</b><small>首次访问映射页触发填充，延迟出现在访问点</small></span><span><b>应用提示</b><small>fadvise/madvise 可表达顺序、随机或即将访问的意图</small></span></div>

## 为什么窗口不能无限大

顺序访问持续出现时，预读窗口会逐渐增长，因为大批量 I/O 通常比单页读取效率高。但如果应用突然跳转到别处，预读的页面可能永远不会使用，反而占据 Page Cache、挤掉其他热点数据，给内存回收与 I/O 带来额外负担。数据库、媒体扫描和日志分析的最佳窗口往往不同，必须由访问模式和设备特性决定。

应用可以在知道模式时给出提示：

```c
posix_fadvise(fd, 0, 0, POSIX_FADV_SEQUENTIAL);
/* 或明确告诉内核此访问随机，避免过度预读 */
posix_fadvise(fd, 0, 0, POSIX_FADV_RANDOM);
```

提示不是强制命令，内核仍会依据全局内存压力和实际访问调整策略。实时路径尤其要避免第一次读大文件才等待预读：应在启动阶段预热所需数据，或将关键数据放在固定内存工作集。

## 如何判断预读真的帮了忙

比较顺序和随机两种访问下的 I/O 吞吐、请求大小、Page Cache 命中、应用等待时间与内存回收。可结合块层统计、ftrace、`perf` 或应用自带的时间戳；不要只看“缓存占用变大”。若预读后吞吐不升反降、后台读 I/O 增加、其他服务缺页更多，说明窗口或访问提示不匹配。

预读是内核对未来的猜测。好的工程设计会让这个猜测有规律可循，并在关键 deadline 前主动把数据准备好。

参考：[Page Cache](https://docs.kernel.org/mm/page_cache.html) · [posix_fadvise(2)](https://man7.org/linux/man-pages/man2/posix_fadvise.2.html)
