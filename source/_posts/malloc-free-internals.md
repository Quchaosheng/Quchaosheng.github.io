---
title: malloc 与 free：用户态分配器如何管理堆内存
date: 2026-02-12 14:00:00
permalink: /2026/07/29/malloc-free-internals/
categories: [技术, C-C++]
tags: [malloc, free, 堆, 内存分配]
---

`malloc()` 通常不会为每一次请求都进入内核。用户态分配器先在已经拥有的堆区、arena、线程缓存和空闲链表中寻找合适大小的块，只有库存不足或请求很大时才通过 `brk`、`mmap` 等向内核扩展虚拟内存。`free(ptr)` 之所以不需要用户再传大小，是因为分配器在块附近或独立元数据中记录了大小、状态和所属结构；这也解释了为什么越界写常常让程序在很久之后的无关 `free()` 中崩溃。

<div class="note-flow"><span>malloc 收到大小请求</span><i>→</i><span>映射到 size class</span><i>→</i><span>从线程缓存或 arena 取块</span><i>→</i><span>记录元数据并返回</span><i>→</i><span>free 后缓存、合并或归还</span></div>

## 分配器要同时解决什么

它要快速满足小对象、支持不同大小、降低多线程争用、控制内部/外部碎片，并在适当时机归还或复用内存。常见策略包括 size class、线程本地缓存、多个 arena、空闲链表/bitmap 和对大块请求的独立 `mmap`。不同 libc 或专用 allocator 的实现细节不同，但“快路径复用、慢路径向系统要内存”是共同思路。

<div class="note-map"><span><b>size class</b><small>将相近大小请求归类，快速从对应空闲结构取块</small></span><span><b>thread cache</b><small>线程本地复用小块，减少全局锁但可能增加内存占用</small></span><span><b>arena</b><small>多个分配区域分散多线程竞争，代价是碎片和 RSS 可能上升</small></span><span><b>metadata</b><small>记录块大小/状态/链接；越界写会破坏它并延迟爆炸</small></span><span><b>brk/mmap</b><small>分配器向内核扩展地址空间的慢路径，不是每次 malloc 都发生</small></span><span><b>free</b><small>通常先缓存或合并，不保证立即把物理页还给操作系统</small></span></div>

## C++ 的对象语义不止是 malloc/free

`new` 负责分配并调用构造函数，`delete` 调用析构后释放；`malloc/free` 只管理原始字节。两套接口必须配对，数组 `new[]/delete[]` 也要配对。`std::vector`、`std::string`、`unique_ptr` 等容器/RAII 类型能把释放时机绑定到对象生命周期，通常比手写 `malloc/free` 更安全。

```cpp
auto p = std::make_unique<Widget>();  // 构造、独占所有权、作用域结束自动析构
std::vector<uint8_t> buffer;
buffer.reserve(4096);                 // 减少高频路径中的反复扩容
```

高频分配成为热点时，优先复用 buffer、提前 `reserve`、批量处理或使用 `std::pmr`/对象池；不要因为“malloc 很慢”就立刻手写 allocator。现代 allocator 在无竞争小对象上可能很快，真正瓶颈也许是初始化、copy、cache miss 或对象生命周期设计。

## 内存错误要用工具抓，而不是猜

double free、use-after-free、越界写和错误配对都属于未定义行为，分配器只是在某个后来时刻发现元数据不一致。AddressSanitizer、Valgrind、glibc 检查与核心转储能将错误靠近发生点；内存泄漏还要区分“逻辑上不再需要但仍被引用”和“分配器尚未归还给 OS”。

实时路径应避免动态分配：提前建立固定容量对象池/环形缓冲，并让 `new`/日志/异常路径不落在控制周期内。分配器的目标是灵活性，而实时路径的目标是可预测性，两者需要用明确边界协作。

参考：[malloc(3)](https://man7.org/linux/man-pages/man3/malloc.3.html) · [AddressSanitizer](https://clang.llvm.org/docs/AddressSanitizer.html)
