---
title: C++20 协程：把异步流程写成顺序代码
date: 2026-02-18 20:00:00
permalink: /2026/07/29/cpp20-coroutines/
categories: [技术, C-C++]
tags: [协程, C++20, 异步编程]
---

C++20 协程不是轻量线程，也不会因为函数里写了 `co_await` 就自动并行。它是编译器把一个可暂停函数改写为状态机的语言机制：局部状态被保存在协程帧中，函数可在等待点挂起，等某个 awaiter 或执行器决定恢复后从原处继续。协程最大的价值是把“发起异步操作 → 等待完成 → 继续处理”的回调链写成顺序代码；真正在哪个线程执行、如何取消、何时销毁，都仍由库和工程设计决定。

<div class="note-flow"><span>调用协程函数</span><i>→</i><span>创建协程帧</span><i>→</i><span>co_await 暂停</span><i>→</i><span>异步事件完成</span><i>→</i><span>恢复并产生结果</span></div>

## 编译器把协程拆成哪些角色

协程返回类型需要关联一个 `promise_type`，它定义初始/最终挂起、返回值和异常行为；`co_await expr` 会寻找 awaiter，依次调用 `await_ready()`、`await_suspend()`、`await_resume()`；协程帧保存 promise、局部变量、参数和当前状态。调度器/执行器通常藏在 awaiter 或 task 类型里，决定恢复时投递到 I/O 线程、线程池还是当前线程。

<div class="note-map"><span><b>coroutine frame</b><small>堆或优化后的存储中保存局部状态，生命周期跨越多个挂起点</small></span><span><b>promise_type</b><small>定义 task 的返回、异常、initial/final suspend 语义</small></span><span><b>awaiter</b><small>决定是否挂起、如何注册完成回调、恢复后返回什么值</small></span><span><b>executor</b><small>决定恢复在哪个线程/事件循环，不是语言自动提供的</small></span><span><b>cancellation</b><small>需要显式传播 stop token/取消句柄，co_await 本身不取消 I/O</small></span><span><b>ownership</b><small>task、frame、引用参数和捕获对象必须在恢复前仍然有效</small></span></div>

## 一个 await 点的真正含义

```cpp
auto bytes = co_await async_read(socket, buffer);
process(buffer, bytes);
```

这不是“线程停住等 socket”。`async_read` 的 awaiter 可能先检查数据是否立即可得；若不可得，注册 I/O 事件并返回控制权；事件到来时，它把 coroutine handle 投递到执行器；恢复时 `await_resume()` 给出结果或抛出异常。理解这条路径后，才能排查为什么协程在错误线程恢复、为什么退出时还有回调访问已释放对象。

## 生命周期是最容易踩的坑

协程会把局部变量延长到 frame 销毁前，但不会自动延长外部引用、`this` 指针、`string_view` 或裸 buffer 的生命周期。一个成员协程若在对象析构后恢复，或者一个 awaiter 保存了已失效的引用，问题往往只在异步延迟出现时爆炸。

实用规则是：让 task 类型明确谁拥有 frame；对跨挂起点的数据使用值语义、`shared_ptr` 或受控 buffer；析构时先取消 I/O、阻止新的恢复，再等待/销毁剩余任务；异常和取消结果要通过统一的返回通道传播，而不是留在 detached coroutine 里丢失。

## 什么时候协程值得用

它适合大量 I/O 等待、状态机复杂、回调层级深的场景，例如网络客户端、异步设备协议、机器人任务编排。它不适合把 CPU 密集循环“伪装成异步”，也不会替代线程池、锁或实时调度。协程减少的是控制流样板代码，不是计算量。

先选择成熟的 task/executor 库或明确的项目约定，再用小范围协程替换一条异步链路。若无法说清一次 `co_await` 后谁会恢复、在哪恢复、谁能取消、谁拥有数据，就还不该把它放进关键路径。

参考：[C++ coroutine language support](https://en.cppreference.com/w/cpp/language/coroutines) · [C++ Coroutines TS concepts](https://isocpp.org/files/papers/N4861.pdf)
