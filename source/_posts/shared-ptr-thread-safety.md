---
title: shared_ptr 的线程安全边界：控制块安全，对象未必安全
date: 2026-07-29 13:33:00
categories: [技术, C-C++]
tags: [智能指针, shared_ptr, 线程安全]
---

`std::shared_ptr` 最容易被误解成“用了它对象就线程安全”。它真正提供的是共享所有权：不同 `shared_ptr` 实例指向同一控制块时，引用计数增减可以安全并发，最后一个所有者释放时对象被销毁。但被管理对象内部字段依然是普通数据；同一个 `shared_ptr` 变量本身被多个线程同时读写也仍可能发生数据竞争。

<div class="note-flow"><span>复制 shared_ptr</span><i>→</i><span>原子增加控制块计数</span><i>→</i><span>使用托管对象</span><i>→</i><span>最后一个引用释放</span><i>→</i><span>析构对象与控制块</span></div>

## 三层线程安全要分开看

第一层是控制块：引用计数和弱引用计数由实现以线程安全方式维护。第二层是 `shared_ptr` 实例：两个独立实例可并发复制/销毁；但一个同名变量被一个线程赋值、另一个线程读取时，需要同步。第三层是对象：`shared_ptr<T>` 不会给 `T` 的成员函数加锁，多个线程修改 `T` 仍须由 `T` 自己提供 mutex、原子或消息传递策略。

<div class="note-map"><span><b>控制块</b><small>strong/weak 引用计数可安全并发维护，管理对象何时析构</small></span><span><b>独立实例</b><small>不同 shared_ptr 变量共享控制块时，复制/销毁通常可并发</small></span><span><b>同一变量</b><small>同时读写同一 shared_ptr 对象仍需 mutex 或 atomic shared_ptr</small></span><span><b>托管对象 T</b><small>不自动同步；成员状态、缓存和协议需独立设计</small></span><span><b>weak_ptr</b><small>用于非拥有观察与打破循环，lock 后仍要考虑对象状态</small></span><span><b>析构边界</b><small>最后一个 strong 引用释放在哪个线程发生，析构成本可能落在那里</small></span></div>

## 发布共享对象的安全方式

若一个线程创建新配置对象，另一个线程周期性读取，可用 mutex 保护那个共享变量，或在 C++20 支持下使用 `std::atomic<std::shared_ptr<T>>` 的 load/store。无论哪种，只保证“拿到的是哪一个对象”；对象内部是否可变仍需单独协议。

```cpp
std::atomic<std::shared_ptr<const Config>> current;

// writer publishes a fully built immutable snapshot
current.store(std::make_shared<const Config>(next), std::memory_order_release);

// reader keeps a local owning copy while using it
auto cfg = current.load(std::memory_order_acquire);
use(*cfg);
```

不可变快照 + 原子替换常比多线程共改一个大对象简单得多。对实时路径而言，也避免了在读配置时持有长 mutex。

## 循环引用和析构线程同样重要

两个对象互持 `shared_ptr` 会让强引用永远不为零，应将非拥有或反向链接改为 `weak_ptr`。此外，最后一个引用的释放可能发生在任意线程，若对象析构会关闭设备、做 I/O 或持锁，就会把不可控工作放进释放路径。可将资源关闭与内存所有权分离，或在受控线程中显式 `stop()/join()`。

`shared_ptr` 解决的是所有权共享，不是并发状态管理。把“谁拥有对象”“谁能修改对象”“对象何时停止”三件事分别设计，才不会让原子引用计数掩盖数据竞争。

参考：[std::shared_ptr](https://en.cppreference.com/w/cpp/memory/shared_ptr) · [atomic shared_ptr](https://en.cppreference.com/w/cpp/memory/shared_ptr/atomic2)
