---
title: 内存屏障与内存序：多核程序如何建立顺序
date: 2026-07-29 13:32:00
categories: [技术, C-C++]
tags: [内存屏障, 内存序, 原子操作]
---

编译器和 CPU 都可能重排独立读写；不同核心也可能在不同时间观察到写入。内存屏障和 C++ 原子内存序用于建立可见性与先后关系。

<div class="note-flow"><span>生产者写入数据</span><i>→</i><span>release 发布标志</span><i>→</i><span>消费者 acquire 标志</span><i>→</i><span>安全读取数据</span></div>

`relaxed` 只保证原子性；release/acquire 构建发布—订阅关系；`seq_cst` 更强且易理解。不要把 volatile 当作线程同步工具，也不要无理由把所有操作设为最强内存序。

参考：[内存屏障](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247484878&idx=1&sn=72cb67af2ea2c1f1a9e3715939864c99)
