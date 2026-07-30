---
title: 环形缓冲区：固定容量队列的基础结构
date: 2026-07-01 09:30:00
permalink: /2026/07/29/circular-buffer/
categories: [技术, C-C++]
tags: [环形缓冲区, 队列, 网络编程]
---

环形缓冲区用固定数组和读写索引实现 FIFO。写指针到末尾后回绕到开头，因此无需移动已有数据，适合网络收发、音视频和 SPSC 队列。

<div class="note-flow"><span>写入 tail 位置</span><i>→</i><span>tail 环绕递增</span><i>→</i><span>消费者读取 head</span><i>→</i><span>head 环绕递增</span></div>

设计时要定义满与空：可保留一个空槽，或额外维护计数/序号。多生产者、多消费者不能只用两个普通索引，需原子协议与每槽位状态。容量满时应明确阻塞、丢弃或覆盖策略。

参考：[环形缓冲区设计与实现](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247485460&idx=1&sn=bf369249b3a1f88f32c95b15d0247750)
