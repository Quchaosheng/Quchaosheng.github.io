---
title: mutex 底层：无竞争走原子操作，有竞争才用 futex
date: 2026-06-25 20:20:00
permalink: /2026/07/29/mutex-futex-internals/
categories: [技术, C-C++]
tags: [mutex, futex, 线程同步]
---

现代用户态 mutex 之所以在无竞争时很快，是因为它通常根本不进入内核：线程用 CAS 等原子操作修改一个锁字，成功就进入临界区。只有发现锁已经被占用、继续自旋不划算时，线程库才调用 futex 的 WAIT 操作，让内核按这个用户态地址把线程挂起；解锁方在检测到有等待者时再调用 WAKE。futex 不是“内核里的互斥锁对象”，而是让内核帮助等待和唤醒同一块用户态内存的机制。

<div class="note-flow"><span>CAS 尝试获取锁</span><i>→</i><span>成功：进入临界区</span><i>→</i><span>失败：futex 等待</span><i>→</i><span>解锁方唤醒</span><i>→</i><span>重新竞争</span></div>

## 快路径、慢路径与锁字状态

快路径只需读取/比较/交换一个原子状态，缓存命中时成本很低。慢路径通常将锁标记为竞争状态，再对该地址执行 futex wait；内核会先验证内存中的期望值，避免“刚决定睡眠时锁已经释放”的丢唤醒竞态。被唤醒后线程仍要重新竞争锁，因为唤醒只是通知，不是所有权转移。

<div class="note-map"><span><b>fast path</b><small>用户态原子 CAS 成功，零系统调用进入临界区</small></span><span><b>contended state</b><small>锁字记录存在竞争，解锁者知道可能需要唤醒等待者</small></span><span><b>FUTEX_WAIT</b><small>内核在用户地址仍等于期望值时挂起当前线程</small></span><span><b>FUTEX_WAKE</b><small>唤醒一个或多个等待该地址的线程，之后仍需重新竞争</small></span><span><b>cache line</b><small>频繁跨核改同一个锁字会产生 cache line 抖动</small></span><span><b>优先级问题</b><small>普通 mutex 不自动解决反转；实时场景可能需 PI mutex/协议设计</small></span></div>

## 为什么 mutex 性能问题常常不是 futex 问题

若 profiler 显示大量 futex wait，通常说明临界区太长、锁粒度太粗、同一共享数据被过多线程写、或线程调度布局不合理。把 mutex 替换成 spinlock 往往只是让等待线程烧 CPU；把所有数据分片、缩短临界区、使用快照/队列或改变任务分工，通常更有效。

```text
坏：lock -> 格式化日志/访问网络/复杂计算 -> unlock
好：lock -> 取必要状态/更新最小字段 -> unlock -> 慢操作在锁外完成
```

还要注意 false sharing：即使两个 mutex 保护不同数据，若它们位于同一 cache line，两个 CPU 频繁修改时仍会相互干扰。高并发结构应考虑对齐、分片和每线程局部状态。

## futex API 与 pthread mutex 的关系

应用通常不直接调用 futex，而使用 `std::mutex`/pthread mutex/condition variable；线程库负责针对平台选择锁字协议、短暂自旋、futex 等实现。直接使用 futex 只适合实现运行时、共享内存同步或需要特殊协议的低层组件，必须同时处理内存序、进程退出、robust list、超时、信号和 ABI。

实时任务若跨优先级等待 mutex，需评估优先级反转；可以使用支持优先级继承的 pthread mutex 属性，或者更好地消除关键路径上的共享等待。futex 让“有竞争时睡眠”高效，但不能让无限等待变成有 deadline 的等待。

参考：[futex(2)](https://man7.org/linux/man-pages/man2/futex.2.html) · [Futexes Are Tricky](https://www.kernel.org/doc/ols/2002/ols2002-pages-479-495.pdf)
