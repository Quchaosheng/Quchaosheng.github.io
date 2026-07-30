---
title: shared_ptr 的线程安全边界：控制块安全，对象未必安全
date: 2026-07-29 13:33:00
categories: [技术, C-C++]
tags: [智能指针, shared_ptr, 线程安全]
---

不同 `shared_ptr` 实例共享同一控制块时，引用计数的增减通常是线程安全的；但被管理对象本身的读写并不会自动加锁，同一个 `shared_ptr` 变量也不能被多个线程无同步地同时修改。

<div class="note-flow"><span>复制 shared_ptr</span><i>→</i><span>原子增加控制块计数</span><i>→</i><span>使用托管对象</span><i>→</i><span>最后一个引用释放</span><i>→</i><span>析构对象与控制块</span></div>

跨线程发布所有权可使用 mutex 或 `std::atomic<std::shared_ptr<T>>`（支持的标准库实现）。对象内部数据仍需要独立同步策略；循环引用则需要 `weak_ptr` 打破。

参考：[shared_ptr 是线程安全的吗？](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247484910&idx=1&sn=c9b2b1da1226a921ea7488e3b70c116f)
