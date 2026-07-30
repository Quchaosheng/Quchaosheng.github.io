---
title: C++20 线程池：任务队列、工作线程与停止协议
date: 2026-06-24 20:20:00
permalink: /2026/07/29/cpp20-thread-pool/
categories: [技术, C-C++]
tags: [线程池, C++20, 并发]
---

线程池复用一组工作线程执行许多短任务，避免“每来一个任务就创建/销毁一个线程”的栈、TLS、调度和生命周期成本。但线程池不是一个 `std::vector<std::thread>`：它至少要定义任务队列、唤醒条件、结果/异常传递、任务容量、停止语义和任务提交后谁负责背压。大多数生产事故都出在停止与过载，而不在 worker 循环本身。

<div class="note-flow"><span>提交任务</span><i>→</i><span>入队并通知</span><i>→</i><span>工作线程取任务</span><i>→</i><span>执行并回收结果</span></div>

## 一个可靠线程池的状态机

运行状态中接受任务、worker 等待条件变量；关闭开始后拒绝新任务或明确走降级队列；已有任务可以选择 drain 完成，也可以取消未开始任务；最后唤醒所有 worker 并 `join`。这些策略必须对调用者可见，否则析构时任务“有时执行有时丢失”会成为难以复现的 bug。

<div class="note-map"><span><b>提交者</b><small>产生任务，面对队列满时阻塞、失败、丢弃或降级的策略</small></span><span><b>有界队列</b><small>缓存突发但限制内存；没有上限的队列只是把背压藏起来</small></span><span><b>worker</b><small>在 mutex + condition_variable 下等待并取出任务</small></span><span><b>future/result</b><small>把返回值和异常带回调用者，避免 worker 中异常终止进程</small></span><span><b>stop token</b><small>C++20 jthread 可表达停止请求，任务仍需主动检查</small></span><span><b>shutdown</b><small>拒绝新任务、唤醒、drain/cancel、join 的明确顺序</small></span></div>

## worker 循环最小模式

```cpp
for (;;) {
    std::unique_lock lock(mu);
    cv.wait(lock, [&] { return stopping || !queue.empty(); });
    if (stopping && queue.empty()) break;
    auto task = std::move(queue.front());
    queue.pop_front();
    lock.unlock();
    task();
}
```

谓词等待防止虚假唤醒；锁只保护队列，不应覆盖任务执行；任务抛出的异常应被 `packaged_task`/future 或明确捕获处理。实际实现还需要处理提交与关闭的竞争、队列上限、任务优先级和统计信息。

## 线程数不是“越多越快”

CPU 密集任务通常接近可用核心数，过多线程会增加上下文切换和 cache 争用；I/O 密集任务可根据等待比例增加并发，但也要受 fd、内存和下游服务能力限制。对于实时控制，线程池通常只适合后台解析、日志和预计算，控制线程不应把 deadline 交给一个可能被队列拥塞的通用 worker。

work stealing、优先级队列和动态伸缩都是进一步优化，不是第一版必需品。先实现有界队列、可测试的停止协议和明确的过载行为，再通过 profiler 判断锁竞争或队列是否真是瓶颈。

参考：[std::jthread](https://en.cppreference.com/w/cpp/thread/jthread) · [std::condition_variable](https://en.cppreference.com/w/cpp/thread/condition_variable)
