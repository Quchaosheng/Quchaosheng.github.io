---
title: 内存屏障与内存序：多核程序如何建立顺序
date: 2026-06-26 20:20:00
permalink: /2026/07/29/memory-ordering-barriers/
categories: [技术, C-C++]
tags: [内存屏障, 内存序, 原子操作]
---

多核程序的问题不只是“两个线程同时改了同一个变量”。编译器为了优化会重排独立读写，CPU 为了流水线和缓存效率也可能让不同核心在不同时间观察到写入。C++ 原子操作和内存序用来表达哪些读写必须以什么顺序对其他线程可见。理解它的目标不是把所有操作写成 `seq_cst`，而是为每一条跨线程数据路径建立清晰的 happens-before 关系。

<div class="note-flow"><span>生产者写入数据</span><i>→</i><span>release 发布标志</span><i>→</i><span>消费者 acquire 标志</span><i>→</i><span>安全读取数据</span></div>

## 最常用的发布—订阅模式

生产者先写普通 payload，再以 release 语义写入原子 `ready=true`；消费者以 acquire 语义读到 `ready=true` 后，保证能够看到生产者在 release 前写好的 payload。这不是“屏障让所有内存立即同步”，而是针对这次原子同步建立了一条可推理的顺序关系。

<div class="note-map"><span><b>relaxed</b><small>只保证该原子变量自身原子性，不建立跨线程数据顺序</small></span><span><b>release</b><small>本线程此前读写不能被移动到发布之后</small></span><span><b>acquire</b><small>本线程之后读写不能被移动到获取之前</small></span><span><b>acq_rel</b><small>读改写原子操作同时承担获取与发布语义</small></span><span><b>seq_cst</b><small>提供单一全局顺序，易理解但可能比需要的更强</small></span><span><b>happens-before</b><small>正确性目标：消费者读取数据前，生产者写入已对其可见</small></span></div>

```cpp
struct Message { int value; } msg;
std::atomic<bool> ready{false};

// producer
msg.value = 42;
ready.store(true, std::memory_order_release);

// consumer
if (ready.load(std::memory_order_acquire))
    use(msg.value);  // 可看到 value = 42
```

如果把两端都换成 `relaxed`，`ready` 本身仍是原子的，却不能保证 `msg.value` 的可见顺序。反之，若只是在单个计数器上做统计且计数与其他数据无关，relaxed 通常恰好是需要的语义。

## volatile 不是线程同步工具

`volatile` 主要用于告诉编译器某次访问不能被随意省略/合并，常用于 MMIO 或信号等特殊场景；它不建立 C++ 线程间的原子性和 happens-before。将共享状态标为 volatile 可能让 bug 更隐蔽，而不是更安全。线程同步应使用 `std::atomic`、mutex、condition variable 或经过验证的并发协议。

## 从协议出发选择内存序

先画出生产者何时写 payload、何时发布状态，消费者先读什么、何时可安全访问数据；再选择最弱但足够的内存序。不要从 CPU 指令或性能传闻反推语义。复杂 MPMC 队列、无锁链表和对象回收往往需要比简单 release/acquire 更完整的证明与压力测试。

ThreadSanitizer 可帮助发现数据竞争，但不等价于证明所有内存序协议正确；在不同 CPU 架构和优化级别下运行测试，才能更早暴露 x86 上偶然没有出现的重排 bug。

参考：[std::memory_order](https://en.cppreference.com/w/cpp/atomic/memory_order) · [C++ memory model](https://en.cppreference.com/w/cpp/language/memory_model)
