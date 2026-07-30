---
title: 优先级反转与 rtmutex：低优先级任务为什么会挡住实时任务
date: 2026-07-30 09:03:00
categories: [技术, Linux实时]
tags: [优先级反转, rtmutex, 优先级继承]
---

高优先级任务等待低优先级任务持有的锁时，中优先级任务可能持续抢占持锁者，导致高优先级任务长期阻塞。优先级继承会临时提升持锁者，使其尽快释放资源。

<div class="note-flow"><span>低优先级线程持锁</span><i>→</i><span>高优先级线程阻塞</span><i>→</i><span>rtmutex 传播高优先级</span><i>→</i><span>持锁者被加速运行</span><i>→</i><span>解锁并恢复原优先级</span></div>

嵌套锁还会形成优先级继承链；缩短临界区和明确锁顺序仍是第一原则。参考：[RT-mutex design](https://docs.kernel.org/locking/rt-mutex-design.html)
