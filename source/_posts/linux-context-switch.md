---
title: 上下文切换：CPU 如何从一个任务切到另一个
date: 2026-05-04 14:00:00
permalink: /2026/07/29/linux-context-switch/
categories: [技术, Linux内核]
tags: [上下文切换, 调度器, CPU]
---

上下文切换是 CPU 从一个可运行任务转去执行另一个任务的过程。它会保存当前任务的寄存器、栈指针和调度状态，恢复下一个任务的执行现场；若两个任务属于不同进程，还可能切换地址空间并影响 TLB。一次切换本身的时间只是成本的一部分，更大的代价常来自缓存、分支预测和内存局部性被破坏，以及切换背后反映出的锁竞争、短任务风暴或错误线程模型。

<div class="note-flow"><span>时钟或阻塞触发调度</span><i>→</i><span>保存当前上下文</span><i>→</i><span>调度器选择下个任务</span><i>→</i><span>切换栈/寄存器/地址空间</span><i>→</i><span>恢复执行</span></div>

## 线程切换和进程切换有什么不同

同一进程内的线程通常共享地址空间，因此切换时不必完全切换页表；不同进程切换则要更新地址空间相关状态，可能造成更多 TLB/cache 影响。无论哪种，寄存器保存恢复、内核栈切换、调度器数据结构操作和 CPU 间迁移都需要成本。

<div class="note-map"><span><b>触发原因</b><small>阻塞 I/O、主动让出、时间片、唤醒抢占或更高优先级任务到来</small></span><span><b>保存现场</b><small>寄存器、栈指针、FPU/架构状态与任务调度信息</small></span><span><b>选择任务</b><small>调度类和 runqueue 决定下一个应执行的 runnable task</small></span><span><b>地址空间</b><small>跨进程切换可能影响页表与 TLB；线程共享通常较轻</small></span><span><b>缓存局部性</b><small>迁移到其他 CPU 或频繁换任务会损失热数据</small></span><span><b>工程信号</b><small>切换异常高通常提示任务粒度、锁、I/O 或线程池设计问题</small></span></div>

## 不要只追求“更少的切换次数”

一个忙等线程可以让上下文切换很少，却浪费 CPU、延迟其他工作；一个合理的 I/O 服务器可能有很多切换，却因批处理和局部性表现良好。应该结合吞吐、P99 延迟、runqueue 长度、CPU migration 和业务任务粒度分析，而不是把某个切换计数当作单独 KPI。

```bash
# 查看系统级切换与迁移统计的起点
vmstat 1
pidstat -w -t 1

# 进一步定位可使用 sched tracepoint / perf sched / ftrace
```

若在实时控制循环里看到频繁切换，应先查是否有锁竞争、定时器过密、无谓唤醒、日志线程或同核 IRQ；若是跨 CPU 迁移造成的 cache 冷启动，则检查亲和性和 cgroup 规划。

## 降低真正有害的切换

让一个工作单元拥有足够的计算粒度，避免为几微秒任务创建线程；用队列和批量处理减少反复唤醒；保持生产者、消费者与数据在合适的 CPU/NUMA 节点附近；将慢 I/O 与实时路径隔离。对线程池而言，固定数量和有界队列通常比“来了任务就开新线程”更稳定。

上下文切换是操作系统正常工作的代价，不是敌人。好的设计不是把它消除，而是让每次切换都带来有价值的进展，并且不破坏关键任务的 deadline。

参考：[Linux scheduler documentation](https://docs.kernel.org/scheduler/index.html) · [perf sched](https://man7.org/linux/man-pages/man1/perf-sched.1.html)
