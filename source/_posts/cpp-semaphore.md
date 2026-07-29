---
title: 信号量：用许可数量协调并发资源
date: 2026-07-29 13:31:00
categories: [技术, 并发]
tags: [信号量, C++20, 同步]
---

信号量维护可用许可计数。`acquire` 在计数大于零时消耗一个许可，否则等待；`release` 归还许可并唤醒等待者。它适合限制有限资源或实现生产消费。

<div class="note-flow"><span>请求资源</span><i>→</i><span>许可大于零</span><i>→</i><span>acquire 消耗许可</span><i>→</i><span>使用资源</span><i>→</i><span>release 归还许可</span></div>

mutex 的目标是一次只允许一个线程进入临界区；计数信号量允许最多 N 个线程同时进入。C++20 的 `counting_semaphore` 适合进程内同步，跨进程还需考虑共享内存与系统级原语。

参考：[C++ 信号量与线程同步](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247484688&idx=1&sn=5d66c88f857d6a02d0dfc435929f38ec)
