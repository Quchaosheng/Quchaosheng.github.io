---
title: C++20 协程：把异步流程写成顺序代码
date: 2026-07-29 13:28:00
categories: [技术, C-C++]
tags: [协程, C++20, 异步编程]
---

C++20 协程是编译器支持的可暂停函数：调用不会一定执行到结束，而可在 `co_await` 暂停，把控制权交给调度器，并在事件完成时恢复。

<div class="note-flow"><span>调用协程函数</span><i>→</i><span>创建协程帧</span><i>→</i><span>co_await 暂停</span><i>→</i><span>异步事件完成</span><i>→</i><span>恢复并产生结果</span></div>

协程不是线程，也不会自动并行。promise type 定义返回对象和异常处理；awaiter 决定何时挂起与恢复；调度器决定在哪个线程继续运行。工程中要特别管理协程帧生命周期、取消、异常传播和执行器绑定。

参考：[C++20 协程：从原理到工程化实战](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247484675&idx=1&sn=56e85ab458292f14aedbec6d40db512a)
