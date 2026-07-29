---
title: pthread 底层：线程创建、同步与退出
date: 2026-07-29 13:12:00
categories: [技术, C-C++]
tags: [pthread, 线程, futex]
---

Linux 中线程和进程都由内核任务表示。`pthread_create()` 最终借助 `clone()` 创建共享地址空间、文件表等资源的新任务，线程库还负责线程栈、TLS 和退出状态管理。

## 互斥锁为什么不总进内核

无竞争时，pthread mutex 通常通过用户态原子操作获取；发生竞争后，失败线程借助 futex 进入内核休眠，解锁方再唤醒等待者。

<div class="note-flow"><span>原子尝试加锁</span><i>→</i><span>无竞争：直接进入</span><i>→</i><span>有竞争：futex 等待</span><i>→</i><span>持锁者解锁</span><i>→</i><span>唤醒并重试</span></div>

## 记忆要点

- 线程共享地址空间，但拥有独立寄存器、栈和调度状态。
- joinable 线程需要 `pthread_join()` 回收线程库资源；detached 线程自动回收。
- 条件变量必须和谓词循环配合，以处理虚假唤醒和竞态。

参考：[不懂 pthread 线程底层，别说你会 Linux 多线程开发](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494951&idx=1&sn=15f04fd9fd0b399b92945c1842bdc19e)
