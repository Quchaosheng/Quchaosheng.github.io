---
title: NUMA 与共享缓存：实时线程为何会被别的 CPU 干扰
date: 2026-07-30 09:27:00
categories: [技术, Linux实时]
tags: [NUMA, LLC, 内存带宽, 实时Linux]
---

CPU 隔离只能减少调度干扰，不能隔离共享末级缓存、内存控制器和互连带宽。另一个核心上的大流量任务仍可能驱逐实时线程的缓存行或占满内存通道，导致执行时间随系统负载变化。
<div class="note-flow"><span>实时线程命中本地数据</span><i>→</i><span>邻核任务争用 LLC/带宽</span><i>→</i><span>缓存失效或排队增加</span><i>→</i><span>最坏执行时间变长</span><i>→</i><span>重新规划 CPU 与内存布局</span></div>

应将线程和内存绑定到同一 NUMA 节点，并用对抗负载验证缓存和带宽干扰；必要时结合 resctrl 做资源监测或分配。最终关注的是最坏执行时间，而非空载跑分。参考：[Resource Control](https://docs.kernel.org/arch/x86/resctrl.html) · [numa(7)](https://man7.org/linux/man-pages/man7/numa.7.html)
