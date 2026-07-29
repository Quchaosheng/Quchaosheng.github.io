---
title: spinlock、rwlock 与 seqlock：内核锁的读写取舍
date: 2026-07-29 14:12:00
categories: [技术, Linux内核]
tags: [spinlock, rwlock, seqlock]
---

spinlock 提供短临界区互斥；rwlock 允许多个读者并行；seqlock 让写者互斥、读者无锁读取并在版本变化时重试。

<div class="note-flow"><span>判断上下文能否睡眠</span><i>→</i><span>评估读写比例与临界区长度</span><i>→</i><span>选择 spin/rw/seq</span><i>→</i><span>配合 IRQ/抢占规则</span></div>

seqlock 适合可重试、复制成本低且不能包含悬空指针的数据。锁选择必须结合中断上下文、抢占、锁顺序与实时性，而不是只看读写比例。

参考：[ARM64 spinlock/rwlock/seqlock 原理](https://www.kerneltravel.net/blog/2020/pr1/)
