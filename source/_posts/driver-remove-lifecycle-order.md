---
title: 驱动卸载偶发卡死：生命周期问题要按所有权逆序处理
date: 2026-08-19 20:30:00
permalink: /2026/08/19/driver-remove-lifecycle-order/
categories: [技术, 项目方法]
tags: [Linux 驱动, IRQ, workqueue, 生命周期]
---

驱动 remove 路径很容易在“正常运行”测试中被忽略。真正麻烦的是卸载时仍有中断、work、timer、DMA completion 或用户调用在路上：一边释放资源，另一边又重新入队，偶发卡死就出现了。

处理这类问题时，我会先画出谁产生事件、谁持有对象、谁可能睡眠，再按所有权逆序关闭。

<div class="note-flow"><span>拒绝新入口</span><i>→</i><span>关闭硬件事件源</span><i>→</i><span>同步在途回调</span><i>→</i><span>取消延后工作</span><i>→</i><span>释放资源</span></div>

<div class="note-map"><span><b>生产者</b><small>IRQ、timer 与用户入口</small></span><span><b>在途工作</b><small>同步回调与引用</small></span><span><b>所有权</b><small>逆序释放资源</small></span></div>

## 先停生产者，再清消费者

如果先 cancel work，却没有屏蔽能再次安排 work 的 IRQ，队列可能在 cancel 返回后重新出现任务。相反，先封住用户入口和硬件事件源，再用 synchronize_irq、cancel_work_sync 等机制等待在途执行结束，才能建立“不会再有新引用”的前提。

等待时还要避免持有回调需要的锁，否则 remove 线程和回调会互相等待。devm 可以帮助释放资源，但不会替你停止设备，也不会自动同步并发回调。

## trace 用来验证顺序

我会把 remove、IRQ、work 入队、work 开始/结束和资源释放放到同一时间线，观察是否存在“释放之后仍有回调”或“等待期间回调拿不到锁”。压力测试应包含反复绑定/解绑、I/O 并发、故障注入和挂起恢复。

通过若干次回归只能说明定义场景未再复现，不能证明所有竞态都消失。最终还要靠生命周期不变量解释为什么顺序成立。

## 参考资料

- [Linux workqueues](https://www.kernel.org/doc/html/latest/core-api/workqueue.html)
- [Generic IRQ handling](https://www.kernel.org/doc/html/latest/core-api/genericirq.html)

## 证据边界

本文不披露具体驱动、设备寄存器、中断号、接口名称或现场次数。不同驱动的关闭顺序必须按自身所有权分析，不能机械照搬。
