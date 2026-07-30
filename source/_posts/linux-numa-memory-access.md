---
title: NUMA：CPU 为什么更偏爱本地内存
date: 2026-07-29 16:09:18
source_checked_at: 2026-07-29 16:09:18
permalink: /2026/07/29/linux-numa-memory-access/
categories: [技术, Linux内核]
tags: [NUMA, 内存管理, 性能]
description: 从首次触碰、CPU 与内存绑定、自动 NUMA balancing 和观测指标出发，解释怎样让计算靠近数据。
---

在双路服务器上，线程固定到一个 CPU 后反而变慢，原因可能不是算力，而是数据仍留在另一个 NUMA 节点。NUMA 把处理器和内存组织成多个节点。CPU 访问本节点内存通常路径更短；跨节点访问需要经过处理器互连，还会占用远端内存控制器和链路带宽。

NUMA 优化的核心不是简单地“绑核”，而是同时回答两个问题：线程在哪里运行，物理页在哪里分配。

## 物理页何时决定归属

`malloc()` 成功往往只建立虚拟地址区间。匿名页通常在第一次实际写入时才通过缺页分配物理页。若没有显式内存策略，这个页倾向于落在执行首次触碰线程所在的节点，这就是常说的 first touch。

<div class="note-flow"><span>进程申请虚拟地址</span><i>→</i><span>工作线程在某节点首次写入</span><i>→</i><span>缺页路径分配本地物理页</span><i>→</i><span>线程反复访问数据</span><i>→</i><span>调度或页面迁移改变亲和性</span></div>

<div class="note-map"><span><b>CPU 节点</b><small>一组 CPU 及其更近的内存控制器</small></span><span><b>内存节点</b><small>物理页所属位置，可能有容量和带宽差异</small></span><span><b>距离矩阵</b><small>描述节点间相对访问成本，不是精确纳秒值</small></span><span><b>首次触碰</b><small>默认策略下由第一次实际访问影响物理页落点</small></span><span><b>内存策略</b><small>bind、preferred、interleave 等策略约束分配</small></span><span><b>自动平衡</b><small>内核采样访问并尝试迁移任务或页面</small></span></div>

一个常见错误是主线程先把大数组全部清零，然后才启动分散在各节点的工作线程。所有页面可能先落到主线程所在节点，其他线程之后一直远程访问。并行初始化能让每个工作线程首次触碰自己负责的区间，但前提是后续计算仍由相近的 CPU 处理这些数据。

## 先看拓扑，再决定策略

```bash
numactl --hardware
lscpu -e=CPU,NODE,SOCKET,CORE,ONLINE
numastat

# 查看目标进程各节点内存和命中情况
numastat -p 1234
grep -E 'Cpus_allowed_list|Mems_allowed_list' /proc/1234/status
head -n 20 /proc/1234/numa_maps
```

`numactl --hardware` 给出节点 CPU、容量和距离矩阵。`numastat -p` 适合观察进程内存分布，`numa_maps` 能进一步显示 VMA 的策略与页位置。字段应结合内核版本解释，不能把 `numastat` 中任意一个累计值直接当作延迟。

做对照实验时，可以分别尝试：

```bash
# CPU 与内存都限制在 node 0
numactl --cpunodebind=0 --membind=0 ./benchmark

# 页面轮流分配到 node 0 和 node 1，适合看带宽扩展，不保证最低延迟
numactl --interleave=0,1 ./benchmark

# 更倾向 node 0，容量不足时允许回退
numactl --preferred=0 ./benchmark
```

`--membind` 比 `--preferred` 更严格，目标节点内存不足时可能让分配失败，因此不应未经容量和回退测试直接用于线上服务。`--interleave` 能分散带宽压力，但会让部分访问必然跨节点；它适合流式大数据，不一定适合共享热表或低延迟控制线程。

## 自动 NUMA balancing 在做什么

开启自动 NUMA balancing 后，内核会通过访问采样判断页与任务是否长期分离，再选择迁移页面或任务。它能修正部分首次放置错误，但采样、保护变化和迁移本身也有成本。工作集稳定、内存充足的长期服务可能受益；严格绑核、实时线程或访问模式快速变化的程序则需要单独测量。

```bash
sysctl kernel.numa_balancing
perf stat -e node-loads,node-load-misses ./benchmark
```

`perf` 事件是否存在、名称如何解释都依赖处理器 PMU。先用 `perf list` 确认，不要把不支持事件得到的空值当成零。

## 常见误判

- 线程绑到 node 0 不代表它访问的页也在 node 0。
- 远端访问增加不一定说明策略错了，共享数据本来就可能被多个节点读取。
- 平均 CPU 利用率正常不能排除互连或单个内存控制器已经饱和。
- 盲目迁移大页可能引入长尾停顿，收益要看数据复用周期。
- 容器的 cpuset CPU 与 memory 节点限制不一致，会制造隐蔽的远程访问。

## 证据边界

“本地更快”是一般规律，不是固定倍率。节点距离、互连、内存频率、缓存命中、页面大小和工作集都会改变结果。首次触碰也会被显式 mempolicy、共享页、页迁移和容量回退覆盖。结论应来自目标机器上的吞吐、尾延迟、内存带宽与页分布对照。

参考：[NUMA Memory Policy](https://docs.kernel.org/admin-guide/mm/numa_memory_policy.html) · [numactl(8)](https://man7.org/linux/man-pages/man8/numactl.8.html) · [numastat(8)](https://man7.org/linux/man-pages/man8/numastat.8.html) · [不懂 NUMA，别再说你懂 Linux 内核了](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494535&idx=1&sn=ceeabb6fb81fb63714d1b5e88bf9fa16)
