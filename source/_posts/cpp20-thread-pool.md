---
title: C++20 线程池：任务队列、工作线程与停止协议
date: 2026-07-29 13:26:00
categories: [技术, C-C++]
tags: [线程池, C++20, 并发]
---

线程池用固定工作线程复用执行资源，避免每个任务都创建线程。核心是任务队列、唤醒机制、生命周期管理和背压，而不是只把函数丢进 `std::thread`。

<div class="note-flow"><span>提交任务</span><i>→</i><span>入队并通知</span><i>→</i><span>工作线程取任务</span><i>→</i><span>执行并回收结果</span></div>

**设计要点**：任务队列要在 mutex 保护下配合条件变量等待；停止时先拒绝新任务，再唤醒所有工作线程并 `join`。CPU 密集型线程数通常接近核心数，I/O 密集型则依据等待比例和压测确定。`std::jthread` 与 stop token 能使停止协议更清晰。

参考：[C++20 手写线程池](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247483987&idx=1&sn=523290d2ec388f4c4777d1b3bd93145c)
