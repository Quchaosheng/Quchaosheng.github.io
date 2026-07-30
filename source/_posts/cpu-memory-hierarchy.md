---
title: CPU 很快，为什么取数据仍然很慢
date: 2026-07-29 16:09:18
source_checked_at: 2026-07-29 16:09:18
permalink: /2026/07/29/cpu-memory-hierarchy/
categories: [技术, 计算机体系结构]
tags: [CPU缓存, 局部性, 性能]
---

CPU 指令执行速度远快于 DRAM 访问速度。现代处理器依靠寄存器、多级缓存、预取和乱序执行隐藏差距；一旦数据不在缓存中，流水线可能等待数十到数百个周期。

## 查找路径

每次加载先经过地址翻译，再按层级查询缓存。命中就返回数据；未命中则继续向更低层请求，并以 cache line 为单位把相邻数据带回。

<div class="note-flow"><span>生成虚拟地址</span><i>→</i><span>TLB 地址翻译</span><i>→</i><span>L1/L2/L3 查询</span><i>→</i><span>访问 DRAM</span><i>→</i><span>回填缓存行</span></div>

## 记忆要点

- 时间局部性：最近使用的数据可能再次使用；空间局部性：相邻数据可能很快被访问。
- 链表随机跳转通常不如连续数组对缓存友好。
- 优化应关注数据布局、工作集和访问顺序，而不只是减少指令条数。

参考：[为什么 CPU 运算很快，查找数据却很慢？](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247495146&idx=1&sn=87fb844eed4cd3dc2c9f4d2f611b4faf)
