---
title: 伪共享：两个不相干的变量为什么会互相拖慢
date: 2026-09-10 09:30:00
permalink: /2026/09/10/false-sharing-cache-line-racing/
categories: [技术, C-C++]
tags: [伪共享, cache line, 并发, 性能]
---

有个压测结果我看了很久没想明白：四个线程各写各的计数器，数据完全独立，锁也没有，却比单线程还慢一大截。

功能测试全绿，结果也对，只有吞吐难看得离谱。后来把结构体打印出来一看，四个计数器挨在一起，全在同一条缓存行上。

这类问题叫伪共享。它不是数据竞争，程序结果通常仍然正确，所以特别容易在代码评审里漏过去。

<div class="note-flow"><span>两个变量相邻存放</span><i>→</i><span>落在同一条缓存行</span><i>→</i><span>两个核各自写</span><i>→</i><span>缓存行在核间来回失效</span><i>→</i><span>写入延迟显著上升</span></div>

<figure class="note-visual"><figcaption><span>共享的是行，不是变量</span>一致性以缓存行为单位维护，变量逻辑上无关挡不住硬件把它们绑在一起。</figcaption><div class="note-map"><span><b>缓存行</b><small>通常 64 字节，是核间一致性维护的基本单位。</small></span><span><b>写失效</b><small>一个核写完，其他核的副本要失效或更新。</small></span><span><b>伪共享</b><small>无关变量因同处一行而互相影响。</small></span><span><b>真共享</b><small>同一个变量被多方访问，要靠同步语义解决。</small></span><span><b>对齐填充</b><small>按行对齐能把变量分到不同行。</small></span><span><b>元素间距</b><small>数组元素小于一行时，相邻元素天然会干扰。</small></span></div></figure>

## 先分清真共享和伪共享

真共享是多个线程访问同一个变量，需要原子操作或锁来保证语义。伪共享是访问不同变量，只需要解决布局上的耦合。

这两个经常被混为一谈，因为表现很像，都是并发下变慢。但处理方式完全相反。给伪共享加锁只会更慢，因为锁本身也在同一行上反复争抢；真共享去掉对齐填充也不会变快。

分辨方法看被写的对象：两个线程写同一个地址，是真共享；写不同地址但性能仍互相影响，才考虑伪共享。

## 什么时候会撞上

最典型的是每线程计数器放在结构体数组里：

```cpp
struct WorkerStats {
  uint64_t processed;   // 每个工作线程各自累加
  uint64_t dropped;
};

WorkerStats stats[kWorkerCount];
```

`WorkerStats` 才 16 字节，四个线程的 `processed` 很可能挤在同一条 64 字节行里。每次累加都让其他核的副本失效，实际写延迟远高于预期。

第二种是热变量和冷变量挨着。高频更新的状态字段旁边放一个只写一次的配置字段，配置本来不需要反复同步，却被拖进同一行。

第三种是队列的生产者索引和消费者索引相邻，两者由不同线程更新，于是每处理一个元素都要经历一次缓存行往返。

## 怎么确认是它

别凭布局猜，先用工具确认热点，再看数据结构。硬件计数器能看到一致性流量：

```bash
perf stat -e cache-misses,cache-references,LLC-load-misses ./my_benchmark
perf c2c record ./my_benchmark
perf c2c report
```

`perf c2c` 就是干这个的，能指出具体地址和涉及的核。如果它报出的热点地址恰好分别是各线程自己的变量，伪共享的判断就有证据了。

测的时候固定负载和线程数，不然线程调度的变化会被误读成布局变化带来的差异。

## 对齐和填充

标准库能查缓存行大小：

```cpp
#include <new>
static_assert(std::hardware_destructive_interference_size >= 64);
```

最简单的做法是给结构体加对齐要求：

```cpp
struct alignas(std::hardware_destructive_interference_size) WorkerStats {
  uint64_t processed;
  uint64_t dropped;
};
```

数组元素因此被分到不同行。代价是内存占用变大，线程多、结构体又小的时候放大很可观。也可以只给热点字段做填充，不需要独占行的字段放一起。

还有一种更结构化的：每线程先累加到局部变量，结束或定期汇总时再合并到共享值。共享值被写的频率从每次操作降到每批一次，代价从缓存一致性转到了聚合逻辑上。

## 改完还要再测一遍

对齐填充会增加内存占用，也可能降低缓存利用率，因为每个线程的有效数据占了更多行。热点如果本来就不在缓存行竞争上，填充不会带来任何收益。

所以顺序是：先测量确认瓶颈，再改布局，再测量确认改善。把对齐当成默认风格写进所有结构体，只会让内存和可读性一起变差，而收益没法验证。

## 参考资料

- [hardware_destructive_interference_size](https://en.cppreference.com/w/cpp/thread/hardware_destructive_interference_size)
- [perf c2c：跨核缓存行竞争分析](https://man7.org/linux/man-pages/man1/perf.1.html)
- [perf 安全与使用限制](https://docs.kernel.org/admin-guide/perf-security.html)

**证据边界：**本文不含任何平台的实测数字。缓存行大小、一致性协议和 `perf c2c` 的输出格式都随架构变，示例里的对齐值要在目标平台上确认；“性能变慢”这个判断必须有测量支撑。
