---
title: 上下文切换：CPU 如何从一个任务切到另一个
date: 2026-07-29 13:36:00
categories: [技术, Linux内核]
tags: [上下文切换, 调度器, CPU]
---

上下文切换保存当前任务的寄存器、栈指针和调度状态，恢复下一个任务的执行现场；若切换进程还可能切换页表并影响 TLB。

<div class="note-flow"><span>时钟或阻塞触发调度</span><i>→</i><span>保存当前上下文</span><i>→</i><span>调度器选择下个任务</span><i>→</i><span>切换栈/寄存器/地址空间</span><i>→</i><span>恢复执行</span></div>

线程切换通常不需要更换地址空间，进程切换成本更高；真正的代价还包括缓存和 TLB 热度丢失。减少过度线程化和短任务抖动通常比微调单次切换更重要。

参考：[CPU 如何切换任务](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247485007&idx=1&sn=e93b7f228f9837e5c851571487fd4791)
