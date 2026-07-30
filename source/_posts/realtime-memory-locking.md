---
title: 实时任务的内存锁定：避免缺页与回收抖动
date: 2026-07-30 09:06:00
categories: [技术, Linux实时]
tags: [mlockall, 缺页, 实时内存]
---

实时线程可用 `mlockall` 锁住当前及未来映射，启动阶段预触碰栈和缓冲区，让页表与物理页提前就绪，避免关键路径发生缺页和内存回收。

<div class="note-flow"><span>启动时分配全部缓冲区</span><i>→</i><span>mlockall 锁定映射</span><i>→</i><span>逐页预触碰内存</span><i>→</i><span>进入实时循环</span><i>→</i><span>循环内不分配、不缺页</span></div>

锁定过多内存会伤害系统整体可用性，应配合资源限制和固定容量设计。参考：[mlock(2)](https://man7.org/linux/man-pages/man2/mlock.2.html)
