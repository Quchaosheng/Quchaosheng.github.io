---
title: 环形缓冲区：固定容量队列的基础结构
date: 2026-05-12 14:00:00
source_checked_at: 2026-07-29 17:36:41
permalink: /2026/07/29/circular-buffer/
categories: [技术, C-C++]
tags: [环形缓冲区, 队列, 网络编程]
---

环形缓冲区用固定数组和读写索引实现 FIFO。写指针到末尾后回绕到开头，因此无需移动已有数据，适合网络收发、音视频和单生产者单消费者队列。它的难点不在取模，而在于满与空的语义、索引发布顺序和容量满后的业务策略。

<div class="note-flow"><span>写入 tail 位置</span><i>→</i><span>tail 环绕递增</span><i>→</i><span>消费者读取 head</span><i>→</i><span>head 环绕递增</span></div>

<figure class="note-visual"><figcaption><span>队列图</span>数据写入完成后再发布 tail，读取完成后再推进 head。</figcaption><div class="note-map"><span><b>storage</b><small>固定容量槽位，生命周期不随每条消息频繁分配释放。</small></span><span><b>head</b><small>消费者下一次读取的位置，只由消费者推进。</small></span><span><b>tail</b><small>生产者下一次写入的位置，只由生产者推进。</small></span><span><b>满与空</b><small>可保留一个空槽，或使用单独计数/序号避免歧义。</small></span><span><b>发布顺序</b><small>先写数据再发布索引，消费者才不会读到半条消息。</small></span><span><b>背压策略</b><small>满时阻塞、丢新、丢旧或覆盖必须由业务截止期决定。</small></span></div></figure>

## SPSC 的简单来自所有权明确

单生产者单消费者场景下，生产者只写 tail 和对应槽位，消费者只写 head 和对应槽位，索引可用合适的原子加载和存储协调。关键是生产者在数据完全写入后再发布 tail，消费者在读完数据后再发布 head；否则 CPU 重排序或编译器优化可能让另一端看到不完整内容。

多生产者或多消费者不能只把两个索引改成原子变量。多个线程可能竞争同一槽位，需要额外的序号、CAS 协议或每槽状态，并且要处理线程暂停后留下的空洞。选择 MPMC 算法前先确认是否真的需要它，很多系统通过单一收发线程就能保持简单可靠。

## 队列满时保什么，决定系统行为

日志和遥测可能允许丢旧数据，控制命令和资源释放消息则通常不能丢。不要把“缓冲区更大”当成唯一答案，它只会推迟拥塞并增加延迟。为每类消息定义容量、最大等待、丢弃计数和告警阈值，队列才是可观测的流量控制点。

参考：[环形缓冲区设计与实现](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247485460&idx=1&sn=bf369249b3a1f88f32c95b15d0247750)
