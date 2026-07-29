---
title: NUMA：CPU 为什么更偏爱本地内存
date: 2026-07-29 13:01:00
categories: [技术, Linux内核]
tags: [NUMA, 内存管理, 性能]
---

NUMA（非一致内存访问）把 CPU、内存划分为多个节点。CPU 访问本节点内存延迟较低，跨节点访问则要经过互连总线，因此线程跑在哪个节点、页面落在哪个节点会直接影响性能。

## 核心机制

Linux 默认采用“首次触碰”策略：虚拟内存被首次实际写入时，物理页通常分配在执行该线程所在的 NUMA 节点。调度器会尽量保持 CPU 与内存亲和性，自动 NUMA balancing 也可能迁移任务或页面。

<div class="note-flow"><span>线程在 Node 0 运行</span><i>→</i><span>首次写入虚拟页</span><i>→</i><span>Node 0 分配物理页</span><i>→</i><span>后续本地访问</span></div>

## 记忆要点

- `numactl --hardware` 查看节点拓扑，`numastat` 观察本地与远端访问。
- 线程绑核却不绑定内存，可能让优化适得其反。
- 数据库、大内存服务和多路服务器最容易受 NUMA 影响。

一句话回答：**NUMA 的关键不是“有几块内存”，而是让计算靠近数据。**

参考：[不懂 NUMA，别再说你懂 Linux 内核了](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494535&idx=1&sn=ceeabb6fb81fb63714d1b5e88bf9fa16)
