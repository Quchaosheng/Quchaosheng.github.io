---
title: pthread 底层：线程创建、同步与退出
date: 2026-06-20 09:30:00
permalink: /2026/07/29/pthread-linux-internals/
categories: [技术, C-C++]
tags: [pthread, 线程, futex]
---

在 Linux 中，进程和线程最终都以 task 形式被内核调度；pthread 是用户态线程库，为你封装了创建参数、线程栈、TLS、取消、join/detach、mutex/condition variable 等高层语义。`pthread_create()` 并不是简单“复制当前函数继续跑”，它会建立新任务所需的栈和线程局部存储，并以共享地址空间、文件表等资源的方式创建新执行流。理解这些边界，才能避免线程泄漏、栈溢出、条件变量丢通知和退出顺序问题。

<div class="note-flow"><span>配置线程属性</span><i>→</i><span>创建内核任务与用户栈</span><i>→</i><span>建立 TLS/启动函数</span><i>→</i><span>执行并同步共享状态</span><i>→</i><span>join 或 detach 回收资源</span></div>

## 一个 pthread 线程包含哪些资源

线程共享进程的虚拟地址空间、打开文件、信号处理配置等，但有独立的寄存器上下文、用户栈、内核调度状态、线程 ID 与 TLS。线程库还维护 cancellation、清理函数、errno/TLS 和退出状态。栈大小、guard page、亲和性、调度策略都可以通过 `pthread_attr_t` 在创建前配置，默认值未必适合深递归、大局部数组或实时线程。

<div class="note-map"><span><b>clone/task</b><small>内核调度实体；线程与进程的区别主要来自共享哪些资源</small></span><span><b>user stack</b><small>每线程独立；大小和 guard page 决定深调用/大局部对象的风险</small></span><span><b>TLS</b><small>线程局部变量和 errno 等状态，在线程创建时建立</small></span><span><b>joinable</b><small>退出后保留可回收状态，必须由 pthread_join 回收</small></span><span><b>detached</b><small>退出后自动回收线程库资源，不能再 join 获取结果</small></span><span><b>cancellation</b><small>需要清理资源和锁；不能把取消当作无条件安全终止</small></span></div>

## join、detach 与线程池为什么不能混用

默认创建的线程是 joinable。它退出后，内核执行实体已结束，但线程库仍保留退出状态等资源，等待其他线程 `pthread_join()`；若永远不 join，也不 detach，长期服务会积累资源。detached 线程适合真正无结果、生命周期完全独立的后台工作，却使错误、结果和停止时机更难控制。

线程池通常不应 detach worker，而是在停止协议中通知它们退出并逐一 join。这样可以保证任务队列、日志、socket 和共享对象在销毁前不再被 worker 访问。

```c
pthread_t th;
pthread_create(&th, NULL, worker, ctx);
/* ... stop worker and make its wait predicate true ... */
pthread_join(th, NULL);
```

## 条件变量的正确模式

condition variable 本身不保存“事件已经发生”的状态，它只能与 mutex 保护的谓词一起使用。`pthread_cond_wait()` 会在等待队列与 mutex 之间完成必要的原子交接：释放 mutex、睡眠，被唤醒后再重新获得 mutex。等待者必须使用 `while` 循环，因为虚假唤醒、多个消费者竞争和状态变化都可能发生。

```c
pthread_mutex_lock(&mu);
while (!queue_has_item() && !stopping)
    pthread_cond_wait(&cv, &mu);
if (stopping && !queue_has_item()) { pthread_mutex_unlock(&mu); return; }
item = pop_item();
pthread_mutex_unlock(&mu);
```

生产者更新谓词后再 signal/broadcast；关闭路径要设置 `stopping` 并唤醒所有等待者。把“先检查、再睡眠、被唤醒后重新检查”交给正确模式，能避免大量偶发死锁。

## 实时和资源管理的边界

实时线程应在创建前固定优先级、CPU、栈和内存策略，避免运行中临时创建线程或扩栈；它们也不应依赖不可控的 detached worker 释放资源。线程不是免费的并发单位，数量、栈、TLS、调度和停止协议都应纳入系统资源预算。

参考：[pthreads(7)](https://man7.org/linux/man-pages/man7/pthreads.7.html) · [pthread_create(3)](https://man7.org/linux/man-pages/man3/pthread_create.3.html)
