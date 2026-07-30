---
title: CPU 很快，为什么取数据仍然很慢
date: 2026-04-17 10:00:00
source_checked_at: 2026-07-29 16:09:18
permalink: /2026/07/29/cpu-memory-hierarchy/
categories: [技术, 计算机体系结构]
tags: [CPU缓存, 局部性, 性能]
description: 从 TLB、缓存行、局部性和硬件计数器出发，分析 CPU 等待内存的原因与可验证的优化方法。
---

程序明明只做了几次加法，为什么换一种数据布局就可能慢几倍？瓶颈往往不在算术指令，而在数据能否及时送到执行单元。现代 CPU 可以并行发射多条指令，DRAM 访问延迟却远高于寄存器和一级缓存。处理器只能依靠多级缓存、硬件预取、乱序执行和同时挂起多个访存请求来隐藏差距；当访问缺乏局部性或工作集超过缓存容量，这些办法都会逐渐失效。

## 一次 load 经过什么

CPU 执行 `load` 时同时面对两件事：虚拟地址要翻译，目标数据要查找。TLB 缓存虚拟页到物理页框的翻译；数据缓存保存最近使用的缓存行。TLB 未命中可能触发硬件页表遍历，数据缓存未命中则继续查询更低层缓存或 DRAM。两条路径都会消耗时间，但它们不是同一种缓存。

<div class="note-flow"><span>生成虚拟地址</span><i>→</i><span>TLB 地址翻译</span><i>→</i><span>L1/L2/L3 查询</span><i>→</i><span>访问 DRAM</span><i>→</i><span>回填缓存行</span></div>

缓存通常以 cache line 为搬运单位，而不是只取程序请求的那几个字节。顺序扫描数组时，同一缓存行里的相邻元素会被连续利用，硬件预取器也容易预测后续地址；链表随机跳转则可能每个节点都引发新的缓存和 TLB 未命中。

<div class="note-map"><span><b>寄存器</b><small>执行单元直接使用，容量最小</small></span><span><b>L1</b><small>每核私有，区分指令与数据的实现很常见</small></span><span><b>L2/L3</b><small>容量逐级增大，命中延迟也逐级增加</small></span><span><b>DRAM</b><small>容量大，但需要经过内存控制器与总线</small></span><span><b>TLB</b><small>缓存地址翻译，不存放普通数据</small></span><span><b>预取器</b><small>猜测后续访问，把数据提前带入缓存</small></span></div>

## 用硬件计数器验证

先固定输入和运行环境，再比较数据布局。`perf stat` 可以观察周期、指令和缓存事件；具体事件名与含义依赖 CPU 型号，不能把不同机器的数字直接横向比较。

```bash
perf stat -r 5 -e cycles,instructions,cache-references,cache-misses \
  ./benchmark --items 10000000

# 检查缓存层次和缓存行大小
lscpu -C
getconf LEVEL1_DCACHE_LINESIZE
```

`cache-misses` 上升不一定就是唯一根因。还要看 IPC、分支预测、内存带宽和输入规模。如果数组版本与链表版本算法复杂度不同，单凭 perf 数字也无法证明是缓存布局造成的差异。

## 写代码时先检查什么

- 时间局部性：最近使用的数据可能再次使用；空间局部性：相邻数据可能很快被访问。
- 结构体数组适合遍历完整对象；只频繁读取少数字段时，字段分离可能减少无关数据搬运。
- 多线程写同一缓存行的不同变量仍可能发生 false sharing，应观察缓存一致性流量，而不是只看源码里有没有锁。
- 优化前先确认热点函数和输入规模。把冷路径改得更“缓存友好”通常没有实际收益。

## 证据边界

本文说明通用层次与观察方法，不给出某颗 CPU 固定的缓存命中延迟。缓存容量、包含关系、预取算法和可用性能事件都取决于微架构；结论必须用目标机器、目标编译选项和真实工作集复测。

参考：[perf-stat(1)](https://man7.org/linux/man-pages/man1/perf-stat.1.html) · [Intel 64 and IA-32 Architectures Optimization Reference Manual](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html) · [为什么 CPU 运算很快，查找数据却很慢？](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247495146&idx=1&sn=87fb844eed4cd3dc2c9f4d2f611b4faf)
