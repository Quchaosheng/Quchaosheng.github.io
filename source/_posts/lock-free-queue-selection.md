---
title: 无锁队列：CAS、内存序与工程选型
date: 2026-07-29 13:25:00
categories: [技术, C-C++]
tags: [无锁队列, CAS, 并发, 内存序]
description: 理解有锁队列与无锁队列的取舍，掌握 CAS、ABA、内存序和有界环形队列的工程边界。
---

无锁队列不是“删掉 mutex 就更快”。它用原子操作和重试替代阻塞等待，适合冲突较少、延迟敏感、并且能严格控制数据结构生命周期的场景。若竞争非常激烈，反复 CAS 失败造成的自旋和缓存行抖动可能比互斥锁更糟。

## 1. 队列首先要保证什么

多个生产者和消费者同时操作队列时，需要同时处理三件事：

- **一致性**：head、tail、元素槽位不能相互矛盾；
- **原子性**：一次入队或出队不能暴露半完成状态；
- **可见性**：生产者写入数据后，消费者必须能以正确顺序看到它。

有锁队列让 mutex 和条件变量承担这些职责，代码直观、易于阻塞等待；无锁队列则要由原子变量、内存序和协议本身实现同样的保证。

<div class="note-flow"><span>生产者准备数据</span><i>→</i><span>原子竞争写入位置</span><i>→</i><span>发布槽位可读状态</span><i>→</i><span>消费者原子获取位置</span><i>→</i><span>读取并释放槽位</span></div>

<div class="note-map"><span><b>SPSC</b><small>单生产者单消费者；有界环形队列最易证明正确，常用于实时数据通道</small></span><span><b>MPSC</b><small>多个生产者争用写入位置；要明确发布顺序和队满策略</small></span><span><b>MPMC</b><small>最复杂；位置竞争、槽位状态和回收都需要成熟算法或库</small></span><span><b>CAS</b><small>更新索引/指针的工具，不自动保证 payload 发布和对象生命周期</small></span><span><b>内存回收</b><small>链表结构需处理 ABA、hazard pointer、epoch 或延迟回收</small></span><span><b>背压</b><small>队满时阻塞、丢新、丢旧或降级是业务语义，不能留空</small></span></div>

## 2. CAS 是无锁队列的基础

CAS（Compare-And-Swap）会原子地执行：“当当前值仍等于 expected 时，把它改成 desired；否则报告失败。”C++ 中常见接口是 `compare_exchange_weak` 与 `compare_exchange_strong`。

```cpp
std::atomic<int> tail{0};
int expected = tail.load(std::memory_order_relaxed);
while (!tail.compare_exchange_weak(
    expected, expected + 1,
    std::memory_order_acq_rel,
    std::memory_order_relaxed)) {
    // expected 已更新为当前 tail；重新检查并尝试
}
```

`weak` 允许伪失败，因此通常放在循环中；`strong` 适合只希望尝试一次或不方便重试的场景。注意：CAS 成功只表示某个索引或指针更新成功，不自动保证整个入队协议已经完成。

## 3. 内存序决定“数据何时对另一线程可见”

典型发布—订阅模式中，生产者先写普通数据，再以 **release** 语义发布“槽位已就绪”；消费者以 **acquire** 语义读取该状态，成功后才能安全读取数据。

<div class="note-flow"><span>写入 payload</span><i>→</i><span>release 发布 ready</span><i>→</i><span>acquire 读取 ready</span><i>→</i><span>读取完整 payload</span></div>

- `relaxed`：只保证该原子变量自身的原子性，不建立跨线程顺序；
- `release`：之前的读写不能被移动到发布之后；
- `acquire`：之后的读写不能被移动到获取之前；
- `seq_cst`：提供更强的全局顺序，易理解但未必是必需的。

先写数据、后发布状态；先获取状态、后读数据，是队列协议中最重要的顺序。

## 4. 无锁实现最难的坑：ABA 与回收

ABA 指一个位置的值从 A 变为 B，之后又变回 A。CAS 只看见“还是 A”，却不知道对象已经被移走、复用或释放过。链表式无锁队列尤其容易遇到这个问题。

常见对策包括版本号/tagged pointer、hazard pointer、epoch-based reclamation（EBR）和 RCU 风格的延迟回收。它们解决的不是“原子交换”，而是**其他线程仍可能持有旧指针时，何时才可释放对象**。

<div class="note-flow"><span>线程读取节点 A</span><i>→</i><span>其他线程移除并复用 A</span><i>→</i><span>地址再次变成 A</span><i>→</i><span>CAS 错把它视为未变化</span><i>→</i><span>版本号或延迟回收避免误判</span></div>

## 5. 先选对模型，再谈无锁

| 场景 | 优先方案 |
| --- | --- |
| 一般业务任务队列、需要阻塞等待 | `mutex + condition_variable` |
| 单生产者单消费者（SPSC） | 有界环形缓冲区，最容易正确实现 |
| 多生产者单消费者（MPSC） | 原子索引/分段队列，明确发布协议 |
| 多生产者多消费者（MPMC） | 成熟库或经过充分验证的带序号环形队列 |
| 高频交易、音视频实时路径 | 预分配有界队列，避免动态分配与阻塞 |

有界环形队列通常比链表队列更适合低延迟路径：容量固定、内存连续、无需频繁分配；代价是队满时必须定义阻塞、丢弃、覆盖或背压策略。

## 6. 实战检查清单

1. 先用 profiler 确认锁竞争是热点，而不是 I/O、序列化或无效复制；
2. 明确生产者/消费者数量，以及队满和队空时的业务语义；
3. 为每个槽位定义“空闲、写入中、已发布、读取中”的状态转换；
4. 对象复用时设计内存回收方案，不能只关注 CAS；
5. 使用 ThreadSanitizer、压力测试和不同 CPU 架构验证；
6. 优先选用经过验证的并发容器，而非手写通用 MPMC 队列。

## 7. 如何验证而不是只做微基准

无锁队列的测试要同时覆盖正确性与性能：在不同核心数、不同生产消费比例、队空/队满切换、对象复用和长时间运行下检查序号是否丢失、重复或乱序；用 ThreadSanitizer 检查数据竞争；用性能计数器观察 CAS 失败、cache miss 和跨核迁移。只在单核空载下跑出更高吞吐，无法证明它在真实竞争中优于 mutex 队列。

对实时场景还要记录队列中的消息年龄。一个永远不丢包但积压 500 ms 的队列，可能比明确丢弃过期状态更糟。

**结论：无锁不是没有代价，而是把等待成本转化为算法、内存序和生命周期管理成本。只有在正确性可验证且性能数据支持时，才值得采用。**

---

本文为学习整理，补充了 C++ 内存模型和工程选型说明。

参考原文：[不懂无锁队列，谈何高并发？](https://mp.weixin.qq.com/s/oEK5RZYSTtMTd4RX20kkWA)，公众号“Linux教程”。
