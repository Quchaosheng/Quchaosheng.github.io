---
title: 信号量：用许可数量协调并发资源
date: 2026-07-29 13:31:00
categories: [技术, 并发]
tags: [信号量, C++20, 同步]
---

信号量表示“当前有多少份可用许可”。`acquire()` 在许可大于零时原子地取走一个，否则等待；`release()` 归还一个或多个许可并唤醒等待者。它非常适合限制有限资源，例如数据库连接、GPU 推理槽位、固定缓冲区、并发下载数，也可表达生产者/消费者中“已有数据项”的数量。它与 mutex 都会让线程等待，但关注的对象不同。

<div class="note-flow"><span>请求资源</span><i>→</i><span>许可大于零</span><i>→</i><span>acquire 消耗许可</span><i>→</i><span>使用资源</span><i>→</i><span>release 归还许可</span></div>

## mutex、condition variable 与 semaphore 的分工

mutex 保护某段临界区或共享状态，通常一次只允许一个线程进入；condition variable 用“状态谓词 + 唤醒”协调等待；计数信号量直接表示可并发使用的资源数量，允许最多 N 个线程同时通过。若你真正需要保护的是一个复杂状态不变量，信号量不能替代 mutex；若资源是固定数量的独立槽位，信号量比手写计数器加条件变量更直接。

<div class="note-map"><span><b>binary_semaphore</b><small>许可只有 0/1，适合简单事件通知或单资源交接</small></span><span><b>counting_semaphore</b><small>许可范围为 0..N，适合并发槽位/缓冲池</small></span><span><b>mutex</b><small>保护共享状态的一致性，不等于资源数量本身</small></span><span><b>condition_variable</b><small>等待任意谓词变化，适合复杂条件与多字段状态</small></span><span><b>acquire</b><small>成功后获得一个许可；等待时不应持有其他会造成死锁的锁</small></span><span><b>release</b><small>必须与资源归还一一对应，过度 release 会破坏容量约束</small></span></div>

## 固定缓冲池的典型用法

```cpp
std::counting_semaphore<kSlots> free_slots{kSlots};

free_slots.acquire();
auto slot = take_free_slot();
fill(slot);
publish(slot);
// 消费者处理完后：return_slot(slot); free_slots.release();
```

信号量只保证许可计数，不管理 `take_free_slot()` 返回哪个对象，也不保证队列本身线程安全。实际池仍需要一个正确的空闲列表/队列、对象生命周期协议和异常路径：一旦填充或发布失败，也要归还 slot 和许可。

## 容量、取消与公平性

标准信号量不承诺严格公平，等待者被唤醒的顺序不应作为业务正确性前提。C++20 提供 `try_acquire_for/try_acquire_until`，可为超时设计退出路径；若任务可取消，还要在 acquire 前后检查 stop token 并确保不会泄漏许可。长期占住许可的任务等同于缩小系统容量，应该被超时、监控和资源审计发现。

对于实时系统，等待信号量意味着 deadline 依赖另一个任务释放资源。要么将资源数和执行预算设计得足够明确，要么改为预分配、无等待的控制路径。信号量让有限资源的数量显式化，但不会自动消除排队延迟。

参考：[std::counting_semaphore](https://en.cppreference.com/w/cpp/thread/counting_semaphore) · [std::binary_semaphore](https://en.cppreference.com/w/cpp/thread/counting_semaphore)
