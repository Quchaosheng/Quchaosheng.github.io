---
title: 伪共享：两个不相干的变量为什么会互相拖慢
date: 2026-09-10 09:30:00
permalink: /2026/09/10/false-sharing-cache-line-racing/
categories: [技术, C-C++]
tags: [伪共享, cache line, 并发, 性能]
---

一段多线程代码里，两个线程各自更新一个独立变量，变量之间没有任何逻辑关系，也不共享锁。按直觉它们应该互不影响，但性能却比单线程还差。原因是这两个变量恰好落在同一条缓存行上，硬件必须维护一致性，于是出现了“伪共享”。

它不是数据竞争，程序结果通常仍然正确。这也是它容易被忽略的原因：功能测试全部通过，只有性能指标异常。

<div class="note-flow"><span>两个变量相邻存放</span><i>→</i><span>落在同一条缓存行</span><i>→</i><span>两个核各自写入</span><i>→</i><span>缓存行在核间来回失效</span><i>→</i><span>写入延迟显著上升</span></div>

<figure class="note-visual"><figcaption><span>共享的是行，不是变量</span>缓存一致性以缓存行为单位，变量逻辑上无关并不影响硬件把它们绑定。</figcaption><div class="note-map"><span><b>缓存行</b><small>通常 64 字节，是核间一致性维护的基本单位。</small></span><span><b>写失效</b><small>一个核写入后，其他核持有的副本需要失效或更新。</small></span><span><b>伪共享</b><small>逻辑无关的变量因同处一行而互相影响。</small></span><span><b>真共享</b><small>同一变量被多方访问，需要同步语义处理。</small></span><span><b>对齐填充</b><small>按缓存行对齐可以把变量分到不同行。</small></span><span><b>实例间距</b><small>数组元素比行小时，相邻元素天然可能互相干扰。</small></span></div></figure>

## 先分清真共享和伪共享

真共享是多个线程访问同一个变量，需要原子操作或锁来保证语义；伪共享是多个线程访问不同变量，只需要消除布局上的耦合。

两者常被混为一谈，因为表现类似：都是并发下变慢。但处理方式完全不同。给伪共享加锁只会更慢，因为锁本身也在同一缓存行上反复争抢；而真共享去掉对齐填充也不会变快。

判断方法是看代码里被写的对象：如果两个线程写的是同一个地址，那是真共享；如果写的是不同地址但性能仍然受对方影响，才考虑伪共享。

## 常见触发场景

最典型的是“每线程计数器放在一个结构体数组里”：

```cpp
struct WorkerStats {
  uint64_t processed;   // 每个工作线程各自累加
  uint64_t dropped;
};

WorkerStats stats[kWorkerCount];
```

如果 `WorkerStats` 只有 16 字节，那么 4 个线程的 `processed` 可能挤在同一条 64 字节缓存行里。每个线程的累加都会让其他核的副本失效，实际写延迟远高于预期。

第二种常见场景是“热变量和冷变量相邻”。比如一个高频更新的状态字段紧挨着一个只写一次的配置字段，配置字段本来不需要缓存行反复同步，却被拖进了同一条行。

第三种是队列的生产者索引和消费者索引放在相邻位置，两者由不同线程更新，于是每处理一个元素都要经历一次缓存行往返。

## 怎么确认是伪共享

不要凭代码布局猜测，先用性能工具确认热点，再检查数据布局。硬件计数器可以观察到缓存一致性流量：

```bash
perf stat -e cache-misses,cache-references,LLC-load-misses ./my_benchmark
perf c2c record ./my_benchmark
perf c2c report
```

`perf c2c` 专门用于观察跨核缓存行竞争，能指出具体地址和涉及的核。如果它报告了热点地址，且这些地址分别对应不同线程各自的变量，伪共享的判断就有证据支持。

观测时要固定负载和线程数，否则线程调度的变化会被误读成布局变化带来的差异。

## 对齐和填充的做法

标准库提供了查询缓存行大小的常量：

```cpp
#include <new>
static_assert(std::hardware_destructive_interference_size >= 64);
```

实践中有几种做法。最简单的是给结构体加上对齐要求：

```cpp
struct alignas(std::hardware_destructive_interference_size) WorkerStats {
  uint64_t processed;
  uint64_t dropped;
};
```

数组元素因此被分到不同缓存行。代价是内存占用增加，如果线程数很多、结构体又很小，内存放大可能很可观。另一种做法是只给热点字段做填充，把不需要独占行的字段放在一起。

还有一种更结构化的做法是每线程使用局部累加，在结束或定期汇总时再合并到共享值。这样共享值被写的频率从“每次操作”降到“每个批次一次”，代价从缓存一致性转移到了聚合逻辑。

## 优化之后要重新测量

对齐填充增加了内存占用，也可能降低缓存利用率，因为它让每个线程的有效数据占满更多行。如果热点本身不在缓存行竞争，填充不会带来收益。

因此正确顺序是：先测量确认瓶颈，再改布局，再测量确认改善。把对齐当作默认风格写进所有结构体，只会让内存和可读性同时变差，而收益无法验证。

## 参考资料

- [硬件干扰尺寸常量（hardware_destructive_interference_size）](https://en.cppreference.com/w/cpp/thread/hardware_destructive_interference_size)
- [perf c2c：跨核缓存行竞争分析](https://man7.org/linux/man-pages/man1/perf.1.html)
- [perf 安全与使用限制](https://docs.kernel.org/admin-guide/perf-security.html)

## 证据边界

本文讨论缓存一致性导致的伪共享现象与排查方式，不包含任何具体平台的实测数据。缓存行大小、一致性协议和 `perf c2c` 的输出格式都随架构变化；文中示例中的对齐值需要按目标平台确认，“性能变慢”的判断必须由测量支持。
