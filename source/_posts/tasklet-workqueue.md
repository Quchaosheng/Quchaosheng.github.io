---
title: Tasklet 与工作队列：中断下半部怎样选
date: 2026-06-04 14:00:00
permalink: /2026/07/29/tasklet-workqueue/
categories: [技术, Linux内核]
tags: [工作队列, Tasklet, 中断]
---

设备中断到来时，CPU 处在最不适合做复杂工作的上下文：不能随意睡眠，长时间占用会阻塞其他中断和实时任务。下半部机制的目的就是把“必须立刻完成的设备确认”与“可以稍后处理的数据、状态机和 I/O”分开。现代内核驱动通常优先考虑线程化 IRQ 或工作队列；tasklet 属于历史上常见的 softirq 下半部机制，新代码一般应避免再引入它。

<div class="note-flow"><span>硬中断确认设备</span><i>→</i><span>清除中断并保存最少状态</span><i>→</i><span>调度下半部</span><i>→</i><span>tasklet 快速处理或 workqueue 可睡眠处理</span></div>

## 先按执行上下文区分，而不是按“快慢”选

硬中断顶半部要尽量短：读取必要寄存器、确认/屏蔽中断、保存少量状态并安排后续处理。tasklet 运行在 softirq 上下文，仍不能睡眠，也不适合访问可能阻塞的资源；工作队列回调由内核线程执行，可以睡眠、获取 mutex、等待 I/O 并调用多数普通内核 API。

<div class="note-map"><span><b>硬中断</b><small>最小确认路径；不能睡眠；尽快离开</small></span><span><b>线程化 IRQ</b><small>可调度的中断后续处理，适合需要优先级/亲和性的路径</small></span><span><b>tasklet</b><small>softirq 上下文；不能睡眠；新代码通常不推荐</small></span><span><b>workqueue</b><small>进程上下文；可睡眠；适合慢操作和复杂状态机</small></span><span><b>专用 worker</b><small>可控制并发和 CPU 归属，适合设备生命周期敏感的工作</small></span><span><b>销毁同步</b><small>取消/flush 正在排队或运行的工作，避免 UAF</small></span></div>

## 工作队列的并发语义很重要

`queue_work()` 只是把回调交给某个 worker pool，并不等于“立刻执行”或“不会并发”。同一 `work_struct` 在排队期间不能被重复当作独立任务使用；多个不同 work 则可能并发运行。若设备寄存器或缓存要求串行访问，应使用单线程/有序队列、显式锁，或把状态合并到一个可重复检查的工作项中。

```c
/* 中断中：只记录事件，后续由可睡眠的 worker 处理 */
if (device_event_pending(dev)) {
    ack_device_irq(dev);
    queue_work(dev->workqueue, &dev->event_work);
}

/* 卸载/错误恢复中：确保回调不再访问即将释放的 dev */
cancel_work_sync(&dev->event_work);
```

真实驱动还要处理设备已经拔出、复位、重复中断与错误恢复等状态。一个只在正常路径正确的工作队列回调，常会在卸载时变成 use-after-free。

## 怎样选一条可维护的路径

若后续工作需要睡眠、等待 DMA、拿 mutex、调用文件系统或执行较长状态机，选 workqueue。若中断处理本身需要可调度、可绑核或与 PREEMPT_RT 配合，优先考虑线程化 IRQ。只有在确实需要极短且不能睡眠的下半部，并且你维护的是已有历史代码时，才需要面对 tasklet 的限制。

最后不要只测吞吐：在高频中断、设备拔插、错误恢复和系统 suspend/resume 下检查工作项是否积压、是否漏事件、是否在销毁后仍运行。下半部设计的好坏，更多体现在异常生命周期而非正常 demo。

参考：[Workqueue](https://docs.kernel.org/core-api/workqueue.html) · [Generic IRQ](https://docs.kernel.org/core-api/genericirq.html)
