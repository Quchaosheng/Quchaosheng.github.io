---
title: 事件驱动状态机：让裸机程序摆脱超级循环
date: 2026-04-28 20:00:00
permalink: /2026/07/29/embedded-event-state-machine/
categories: [技术, 嵌入式]
tags: [状态机, 事件驱动, 裸机]
---

事件驱动架构把中断、定时器和输入转换为事件，再由状态机根据当前状态执行短小动作。它解决的不是“如何写一个循环”，而是如何把隐藏在大量 `if`、延时和标志位里的状态关系显式写出来。这样超时、取消和异常输入才有清楚的去处。

<div class="note-flow"><span>中断/定时器产生事件</span><i>→</i><span>事件入队</span><i>→</i><span>调度器分发</span><i>→</i><span>状态机执行转换</span><i>→</i><span>输出动作并等待下一事件</span></div>

<figure class="note-visual"><figcaption><span>状态图</span>状态、事件、守卫条件和动作各自负责一件事。</figcaption><div class="note-map"><span><b>事件源</b><small>中断、定时器、通信和按键只产生事实，不做业务决策。</small></span><span><b>事件队列</b><small>规定容量、丢弃策略和生产者上下文。</small></span><span><b>当前状态</b><small>例如 idle、connecting、running、fault，必须可观察。</small></span><span><b>守卫条件</b><small>在转移前检查资源、权限和输入是否仍有效。</small></span><span><b>转移动作</b><small>保持短小，必要的耗时工作交给后续任务。</small></span><span><b>超时事件</b><small>与普通事件一样进入状态机，避免散落的阻塞延时。</small></span></div></figure>

## 中断里只投递事件

中断处理程序应该尽快读取必要状态、清除硬件标志并投递事件。它不应等待通信、调用复杂回调或执行状态转换，因为这些操作会放大中断延迟，也容易与主循环并发修改同一份状态。事件队列的生产者、消费者和满队列策略要明确：关键故障事件不能被普通日志挤掉。

## 让所有退出路径都可见

好的状态机不仅有“成功下一步”，还要有超时、取消、资源缺失和恢复路径。给每个等待状态配置一个超时事件，给每个外部输入定义可接受状态，避免收到旧事件后误触发新的任务。状态转换表比层层嵌套的 `switch` 更容易审查，尤其适合通信协议、升级流程和设备初始化。

参考：[EFSM](https://gitee.com/simpost/EFSM)
