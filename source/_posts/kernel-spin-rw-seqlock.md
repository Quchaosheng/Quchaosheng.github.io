---
title: spinlock、rwlock 与 seqlock：内核锁的读写取舍
date: 2026-04-20 14:00:00
permalink: /2026/07/29/kernel-spin-rw-seqlock/
categories: [技术, Linux内核]
tags: [spinlock, rwlock, seqlock]
---

内核锁的选择不能只看“读多还是写多”。更先要问的是：当前上下文能不能睡眠？临界区会持续多久？读者能否接受重试？数据里有没有指针或需要跨字段保持一致的对象？同一套数据在进程、中断和 softirq 上下文中被访问吗？这些答案决定了锁语义，之后才是性能取舍。

<div class="note-flow"><span>判断上下文能否睡眠</span><i>→</i><span>评估读写比例与临界区长度</span><i>→</i><span>选择 spin/rw/seq</span><i>→</i><span>配合 IRQ/抢占规则</span></div>

## 三种锁分别在保护什么

`spinlock` 提供互斥：抢不到锁的 CPU 会短暂自旋，因此持锁区必须极短，且不能执行会睡眠的操作。它适合硬中断、softirq 或必须在原子上下文保护的共享状态。

`rwlock` 将读者和写者区分开：多个读者可并行，写者独占。它适合读临界区不太长、读者真的能并行获益、写入并不频繁的场景；读写锁并不能自动避免写者饥饿或长读者阻塞写入，需要看实现与工作负载。

`seqlock` 让写者串行更新一个序列号，读者不加锁地复制数据，若发现读期间序列变化就重试。它把读路径做得很轻，却要求读者能安全重试，且保护的数据不能包含会在重试时失效的悬空指针。

<div class="note-map"><span><b>spinlock</b><small>短临界区互斥；不能睡眠；适合原子上下文</small></span><span><b>rwlock</b><small>多个读者并行；写者独占；读写比例必须值得</small></span><span><b>seqlock</b><small>读者无锁复制；发现写入后重试；适合简单快照</small></span><span><b>IRQ 规则</b><small>同一锁若会被中断上下文获取，要处理本地 IRQ/softirq 重入</small></span><span><b>PREEMPT_RT</b><small>部分锁语义会变化；不能用“传统自旋”假设替代上下文分析</small></span><span><b>共同底线</b><small>明确锁顺序，临界区不做 I/O、日志和未知时长调用</small></span></div>

## seqlock 的读者为什么要重试

写者更新前后会改变 sequence。读者先读取 sequence，复制所需字段，再检查 sequence 是否发生变化或处于写入状态；若变了，就重新读。它常用于时间、统计和坐标等“读者需要一份一致快照、重读代价很低”的数据。

```c
unsigned int seq;
struct state snapshot;

do {
    seq = read_seqbegin(&state_lock);
    snapshot = shared_state;   /* 只复制可安全重读的简单数据 */
} while (read_seqretry(&state_lock, seq));
```

若 `shared_state` 内含会被释放的指针，仅重试不能阻止读者先解引用无效对象。此类生命周期问题要用 RCU、引用计数或其他对象所有权机制解决，不能用 seqlock 代替。

## 上下文决定比读写比例更早

硬中断和 softirq 不能睡眠，通常需要自旋类保护；进程上下文若可能等待，应使用 mutex、completion 或其他可睡眠同步原语。若同一数据既在进程上下文又在中断中访问，还必须防止持锁期间被本 CPU 中断重入，常见接口如 `spin_lock_irqsave()` 的意义就在这里。不要因为“临界区只有几行”就忽略中断/抢占规则。

在 PREEMPT_RT 下，大量常规 spinlock 会获得不同的实现语义以降低延迟，但 `raw_spinlock` 仍有严格原子特性。驱动代码应遵循所用 API 的上下文约束，而不是把某一种内核配置下的偶然行为当成通用规则。

## 锁设计的实用检查表

1. 写下每把锁的保护对象、获取上下文和锁顺序。
2. 测量最长持锁时间，而不是只统计平均等待时间。
3. 把拷贝、计算、日志和设备访问尽可能移到锁外。
4. 读多写少且可重试时再考虑 seqlock；对象生命周期复杂时先解决所有权。
5. 用 lockdep、trace 和压力测试验证锁顺序与实际竞争，而不是凭直觉选最快的原语。

参考：[Linux kernel locking guide](https://docs.kernel.org/locking/index.html) · [seqlock](https://docs.kernel.org/locking/seqlock.html)
