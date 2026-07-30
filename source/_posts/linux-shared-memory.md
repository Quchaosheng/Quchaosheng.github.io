---
title: Linux 共享内存：少复制不等于零成本
date: 2026-06-21 14:10:00
permalink: /2026/07/29/linux-shared-memory/
categories: [技术, Linux内核]
tags: [共享内存, IPC, mmap]
---

共享内存让多个进程把同一组物理页映射到各自虚拟地址空间。数据无需经过内核中转缓冲区反复复制，因此适合传输大块数据，但同步、所有权和生命周期必须由应用设计。

## 建立与通信

进程通过 POSIX shared memory、System V 接口或共享文件获得同一后备对象，再分别 `mmap`。页表建立后，双方读写的是相同物理页；锁、信号量或无锁队列负责协调访问。

<div class="note-flow"><span>创建共享对象</span><i>→</i><span>两个进程分别 mmap</span><i>→</i><span>页表指向相同物理页</span><i>→</i><span>同步发布数据</span><i>→</i><span>对端直接读取</span></div>

## 记忆要点

- “零拷贝”通常指省去进程间数据复制，缓存一致性和页表成本仍存在。
- 指针值不能直接跨进程使用，应采用偏移量或固定格式。
- 必须定义生产者、消费者、异常退出和对象清理协议。

参考：[拆解 Linux 共享内存原理：“零拷贝”通信的核心机制](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494326&idx=1&sn=7fbdac5c9294a6dc76a45bda1ccd9f82)
