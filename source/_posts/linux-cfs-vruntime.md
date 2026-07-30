---
title: CFS 与 vruntime：Linux 如何分配 CPU 时间
date: 2026-07-29 16:09:18
source_checked_at: 2026-07-29 16:09:18
permalink: /2026/07/29/linux-cfs-vruntime/
categories: [技术, Linux内核]
tags: [CFS, 调度器, 红黑树]
---

CFS 的目标不是让每个任务运行同样久，而是按权重实现公平。它用 `vruntime` 记录任务经过权重修正后的运行时间，优先选择 vruntime 较小的可运行任务。

## 调度过程

传统 CFS 运行队列使用红黑树组织调度实体，最左节点代表当前最“欠 CPU 时间”的任务。nice 值越低，权重越大，同样运行时间带来的 vruntime 增量越小。

<div class="note-flow"><span>任务进入运行队列</span><i>→</i><span>按 vruntime 排序</span><i>→</i><span>选择最小者运行</span><i>→</i><span>累计加权运行时间</span><i>→</i><span>重新入队</span></div>

## 记忆要点

- vruntime 是“公平债务”，不是实际墙上时间。
- 红黑树提供有序插入和删除，选择最左节点成本低。
- 唤醒抢占还会考虑粒度，避免频繁切换。

一句话回答：**CFS 用加权虚拟运行时间衡量公平，让欠得最多的任务先运行。**

参考：[不懂 CFS 与 vruntime 红黑树，别再说你懂 Linux 内核了](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494598&idx=1&sn=6ab2a6e66df2ceda53462349a38319d8)
