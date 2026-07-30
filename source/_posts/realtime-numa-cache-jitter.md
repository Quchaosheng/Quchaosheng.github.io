---
title: NUMA 与共享缓存：实时线程为何会被别的 CPU 干扰
date: 2026-07-21 14:00:00
permalink: /2026/07/30/realtime-numa-cache-jitter/
categories: [技术, Linux实时]
tags: [NUMA, LLC, 内存带宽, 实时Linux]
---

把实时线程独占一个 CPU 后，仍可能发现执行时间随“其他核在干什么”而波动。原因是核心并不独占整台芯片：同一 NUMA 节点中的 CPU 可能共享末级缓存（LLC）、内存控制器和互连带宽；跨节点访问还会经过更长路径。另一个核心上大规模 memcpy、GPU DMA、数据库或网络包处理，都可能让实时线程的缓存命中率下降、内存访问排队变长。

<div class="note-flow"><span>实时线程命中本地数据</span><i>→</i><span>邻核任务争用 LLC/带宽</span><i>→</i><span>缓存失效或排队增加</span><i>→</i><span>最坏执行时间变长</span><i>→</i><span>重新规划 CPU 与内存布局</span></div>

## CPU 亲和性不等于内存亲和性

Linux 常用“首次触碰”分配策略：一页虚拟内存第一次被实际访问时，物理页通常会分配在执行该访问的 NUMA 节点。若启动线程在 CPU 0 上分配/触碰缓冲区，后来把实时线程迁到另一个节点，关键数据就可能长期跨节点访问。线程绑核、数据预触碰和内存策略应作为同一件事设计。

<div class="note-map"><span><b>CPU 亲和性</b><small>控制线程在哪里运行，减少调度迁移</small></span><span><b>首次触碰</b><small>首次真正访问页的 CPU 常决定它落在哪个 NUMA 节点</small></span><span><b>本地内存</b><small>访问延迟和带宽通常更可预测</small></span><span><b>远端内存</b><small>需要经过节点互连，延迟与拥塞更敏感</small></span><span><b>共享 LLC/带宽</b><small>即使同节点也会受邻核大流量任务干扰</small></span><span><b>resctrl</b><small>可用于监测或分配部分缓存/带宽资源，需硬件支持</small></span></div>

## 先看拓扑，再谈优化

在多路系统上，先查看节点、CPU 和距离矩阵；再把线程与其工作集绑定到同一节点。`numactl` 可以作为实验工具验证亲和性假设，但生产环境更应将策略固化在服务启动、cgroup 或资源管理器配置中。

```bash
numactl --hardware
numactl --cpunodebind=0 --membind=0 ./realtime_app
```

该示例表示同时约束 CPU 和内存节点。是否应强制绑定、允许 fallback，取决于容量与故障策略；如果节点内存耗尽，硬性策略可能让程序直接失败，这也是需要提前设计的行为。

## 用对抗负载量最坏执行时间

空载时 CPU 本地性看起来常常没有区别。更有意义的测试是：在相邻核发起持续内存带宽压力，或运行实际视频/GPU DMA 负载，同时记录实时线程的周期执行时间和 cache miss 指标。若长尾随邻核负载增长，说明瓶颈不在调度器，而在共享资源。

优化选择包括：调整 CPU/NUMA 布局、将热点数据压缩到缓存、减少不必要的拷贝、把大吞吐任务移动到远离实时核的节点，必要时使用硬件支持的 resource control。目标不是让一切绝对隔离，而是对共享资源造成的最坏执行时间有可验证的上界。

参考：[Resource Control](https://docs.kernel.org/arch/x86/resctrl.html) · [numa(7)](https://man7.org/linux/man-pages/man7/numa.7.html)
