---
title: RT-Thread 启动与调度：从 reset 到第一个线程
date: 2026-07-30 09:01:00
categories: [技术, RT-Thread]
tags: [RT-Thread, 启动, 调度]
---

RT-Thread 启动先完成板级初始化、系统对象与定时器初始化，再创建 idle、timer 和应用线程，最后启动调度器。调度采用基于优先级的抢占策略，同优先级线程可按时间片轮转。

<div class="note-flow"><span>Reset/入口汇编</span><i>→</i><span>板级与内核对象初始化</span><i>→</i><span>创建系统和应用线程</span><i>→</i><span>启动调度器</span><i>→</i><span>最高优先级就绪线程运行</span></div>

线程应把等待交给 IPC，而不是轮询占用 CPU；优先级设计还要防止高优先级线程长期饿死低优先级任务。参考：[RT-Thread](https://github.com/RT-Thread/rt-thread)
