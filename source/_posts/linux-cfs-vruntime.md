---
title: CFS 与 vruntime：Linux 如何分配 CPU 时间
date: 2026-07-29 16:09:18
source_checked_at: 2026-07-29 16:09:18
permalink: /2026/07/29/linux-cfs-vruntime/
categories: [技术, Linux内核]
tags: [CFS, 调度器, 红黑树]
description: 用 vruntime、权重和运行队列解释传统 CFS 的公平模型，并给出从进程指标到调度跟踪的验证方法。
---

两个一直占用 CPU 的任务，nice 值不同，为什么最终得到的处理器时间也不同？传统 CFS 的回答不是固定时间片，而是一把随运行不断更新的“公平尺子”：`vruntime`。任务实际运行得越久，虚拟运行时间越大；权重越高，同样一段实际时间折算出的增量越小。

这里讨论的是理解 Linux 公平调度的经典 CFS 模型。较新的 Linux 内核已在公平类中引入 EEVDF 选择逻辑，但 `vruntime`、权重和公平份额仍是理解新实现的基础。

## vruntime 怎样体现权重

概念上可以把增量写成：

```text
delta_vruntime = delta_exec * NICE_0_LOAD / weight
```

`delta_exec` 是任务本次实际执行时间，`weight` 由 nice 值映射而来。nice 越低，权重越大，`vruntime` 增长越慢。调度器因此允许高权重任务运行更久，同时让各任务的虚拟进度长期接近。

<div class="note-flow"><span>任务进入可运行队列</span><i>→</i><span>比较虚拟进度</span><i>→</i><span>选择最欠公平份额的任务</span><i>→</i><span>累计实际执行时间</span><i>→</i><span>按权重更新 vruntime</span></div>

<div class="note-map"><span><b>实际运行时间</b><small>任务真正占用 CPU 的时间，来自调度时钟统计</small></span><span><b>权重</b><small>由 nice 值映射，决定任务的长期 CPU 份额</small></span><span><b>vruntime</b><small>按权重缩放后的虚拟进度，不等于墙上时间</small></span><span><b>min_vruntime</b><small>运行队列的公平基线，避免新任务从零开始获利</small></span><span><b>红黑树</b><small>传统 CFS 用它有序组织调度实体</small></span><span><b>唤醒抢占</b><small>兼顾响应时间与切换成本，不是见到更小值就无条件切换</small></span></div>

传统实现把可运行调度实体放进按虚拟时间组织的红黑树。最左侧实体通常是虚拟进度最小者，也就是相对更“欠”CPU 的任务。运行队列还维护 `min_vruntime`。一个刚唤醒或刚创建的任务不会简单地以零为起点，否则它会长期压过已经运行的任务。

## 公平不等于每毫秒都平分

CFS 追求一段时间内的比例公平。调度粒度、唤醒行为、CPU 数量、任务睡眠与迁移都会让短时间观测产生偏差。一个 I/O 密集任务睡眠很久后被唤醒，调度器希望它尽快响应，但也要限制这种优势，不能让反复睡眠成为无限获取 CPU 的办法。

多核场景还多了一层负载均衡。每个 CPU 有自己的运行队列，调度域按拓扑周期性比较负载并迁移任务。任务亲和性、缓存热度和 NUMA 位置都会影响迁移决策，所以单核公式不能完整解释多核吞吐。

## 在机器上看权重与运行时间

```bash
# 启动两个持续计算任务，并降低第二个任务的调度优先级
taskset -c 2 yes > /dev/null &
P1=$!
taskset -c 2 nice -n 10 yes > /dev/null &
P2=$!

# 观察两个任务的 CPU 时间、nice 与调度统计
ps -o pid,ni,pri,psr,time,comm -p $P1,$P2
grep -E 'se\.vruntime|sum_exec_runtime|nr_switches' /proc/$P1/sched
grep -E 'se\.vruntime|sum_exec_runtime|nr_switches' /proc/$P2/sched

kill $P1 $P2
```

这只是教学实验。应固定到同一 CPU，避免不同核并行掩盖份额差异；同时不要在繁忙生产机上运行无限循环。字段名称和 `/proc/PID/sched` 输出会随内核配置、版本变化。

如果需要定位一次异常切换，可记录调度事件：

```bash
sudo perf sched record -- sleep 5
sudo perf sched timehist
```

`perf sched` 展示实际发生了什么，但不能单独证明调度器有问题。锁竞争、缺页、中断和 I/O 等待都会让任务离开 CPU。

## 常见误解

- `vruntime` 小不等于进程刚创建，它表示相对公平基线的虚拟进度。
- nice 不是给任务预留固定百分比。可运行任务集合变化后，份额也会变化。
- 红黑树是组织与选择手段，不是公平策略本身。
- CPU 使用率低不一定是没被调度，任务可能正在等待锁、I/O 或定时器。
- 在 cgroup 中，进程权重还会受到组调度层级影响。

## 证据边界

本文用传统 CFS 解释 `vruntime`，不把它当成所有内核版本的完整选取算法。Linux 6.6 起公平调度逐步采用 EEVDF 机制，具体字段、树结构和抢占细节应以目标内核源码与文档为准。实验结论也只适用于相同 CPU 亲和性、负载和 cgroup 配置。

参考：[CFS Scheduler](https://docs.kernel.org/scheduler/sched-design-CFS.html) · [Scheduler Nice Design](https://docs.kernel.org/scheduler/sched-nice-design.html) · [sched(7)](https://man7.org/linux/man-pages/man7/sched.7.html) · [不懂 CFS 与 vruntime 红黑树，别再说你懂 Linux 内核了](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494598&idx=1&sn=6ab2a6e66df2ceda53462349a38319d8)
