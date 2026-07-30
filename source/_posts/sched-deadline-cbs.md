---
title: SCHED_DEADLINE：用运行预算和截止期调度周期任务
date: 2026-07-19 14:00:00
permalink: /2026/07/30/sched-deadline-cbs/
categories: [技术, Linux实时]
tags: [SCHED_DEADLINE, EDF, CBS]
---

当一个任务可以明确说出“我每 10 ms 来一次、最坏需要 1 ms CPU、最晚 8 ms 必须完成”时，`SCHED_DEADLINE` 往往比手工安排一堆 FIFO 优先级更贴近问题本身。它采用最早截止期优先（EDF）选择任务，并使用 Constant Bandwidth Server（CBS）为每个任务分配运行预算。这样某个任务突然超量执行时，不会无休止侵占其他 deadline 任务的带宽。

<div class="note-flow"><span>声明 runtime/deadline/period</span><i>→</i><span>内核执行准入检查</span><i>→</i><span>按最早截止期运行</span><i>→</i><span>消耗完预算后节流</span><i>→</i><span>下周期补充并重排</span></div>

## 三个参数不是同一个“时间”

`runtime` 是一个周期内任务最多可获得的 CPU 执行时间；`deadline` 是本次作业相对激活时刻的完成期限；`period` 是下一次预算补充/新作业到来的周期。典型约束为 `runtime <= deadline <= period`。例如 `runtime=1 ms, deadline=8 ms, period=10 ms` 描述的不是“线程每次只能跑 1 ms”，而是一个有带宽和完成期限的周期模型。

<div class="note-map"><span><b>runtime</b><small>每个 period 中可消耗的 CPU 预算，来自最坏执行时间估计</small></span><span><b>deadline</b><small>这次作业应完成的相对期限，影响 EDF 排序</small></span><span><b>period</b><small>预算与作业的周期，决定长期 CPU 带宽</small></span><span><b>带宽占比</b><small>可先粗略估算为 runtime / period</small></span><span><b>CBS 节流</b><small>任务耗尽预算后等待补充，保护其他任务</small></span><span><b>准入控制</b><small>内核拒绝明显超卖的 deadline 任务组合</small></span></div>

以这个例子而言，单任务的理论带宽需求是 `1 / 10 = 10%` 的一个 CPU。多任务合计不能把 CPU 买空，还要给 IRQ、内核工作、缓存抖动和业务恢复路径留余量。准入成功说明内核带宽模型没有明显冲突，不说明真实硬件上的锁、DMA 或内存访问一定能在 deadline 内完成。

## CBS 如何避免一个任务拖垮全局

若 deadline 任务超出 `runtime`，CBS 会让它暂时没有预算，避免它一直抢占其他早截止期作业。这个机制对系统稳定很重要，但如果你没有把“预算耗尽”纳入业务状态机，就会看到任务突然延迟却不知道原因。因此应同时记录每轮实际执行时间、deadline miss 和预算耗尽事件。

```text
任务激活 -> 分配本轮 deadline 与预算 -> EDF 运行
       -> 正常完成：等待下一个 period
       -> 超出 runtime：CBS 节流 -> 等待预算补充/重新排期
```

不要通过把 runtime 填得很大来躲开节流；那只是把风险转移给其他任务。真正应优化的是算法最坏执行时间、输入规模、锁、CPU 布局和优先级关系。

## 使用前要回答的工程问题

1. 任务的最坏执行时间来自真实测量，还是一次空载平均值？
2. deadline 是业务可接受的完成时间，还是随手填成等于 period？
3. 任务阻塞在锁、I/O 或 GPU 上时，谁负责取消或降级？
4. 任务在哪个 CPU 运行，该 CPU 的 IRQ/RCU/频率噪声是否已处理？
5. 发生 deadline miss 后，机器人/设备会继续使用过期结果，还是切换到安全动作？

`SCHED_DEADLINE` 很强，但它要求你对任务模型更诚实。参数越能反映真实资源需求，系统的可分析性就越高。

参考：[Deadline Task Scheduling](https://docs.kernel.org/scheduler/sched-deadline.html) · [sched(7)](https://man7.org/linux/man-pages/man7/sched.7.html)
