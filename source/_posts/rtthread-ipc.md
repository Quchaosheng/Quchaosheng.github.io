---
title: RT-Thread IPC：信号量、互斥量、事件与消息队列
date: 2026-07-30 09:02:00
categories: [技术, RT-Thread]
tags: [IPC, 信号量, 消息队列]
---

信号量适合资源计数与简单通知；互斥量提供所有权和优先级继承；事件集适合多个布尔条件组合；邮箱和消息队列用于在线程间传递数据。

<div class="note-flow"><span>明确同步还是传数据</span><i>→</i><span>选择 IPC 对象</span><i>→</i><span>线程阻塞等待</span><i>→</i><span>生产者发布/释放</span><i>→</i><span>内核唤醒合适线程</span></div>

中断上下文只能使用允许的非阻塞接口；消息队列容量要结合突发流量和背压策略设计。参考：[RT-Thread](https://github.com/RT-Thread/rt-thread)
