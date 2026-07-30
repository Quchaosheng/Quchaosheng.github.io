---
title: 软件定时器：用一个硬件时基管理多个超时
date: 2026-06-02 14:00:00
permalink: /2026/07/29/embedded-software-timer/
categories: [技术, 嵌入式]
tags: [软件定时器, Tick, 调度]
description: 比较链表、最小堆和时间轮的取舍，并处理定时器回绕、取消与回调并发语义。
---

一个 MCU 的硬件定时器数量有限，但超时需求很多：按键长按、通信重试、传感器采样、状态机等待和看门狗监督都需要各自的截止时间。软件定时器把这些截止时间组织到统一数据结构中，由一个时基推进；关键在于选择合适的结构，并把“发现到期”和“执行回调”分开。

<div class="note-flow"><span>注册超时与回调</span><i>→</i><span>插入定时器结构</span><i>→</i><span>Tick/硬件比较到期</span><i>→</i><span>取出到期项</span><i>→</i><span>任务上下文执行回调</span></div>

<figure class="note-visual"><figcaption><span>时间图</span>定时器数据结构负责排序，到期回调由安全的执行上下文负责。</figcaption><div class="note-map"><span><b>绝对到期点</b><small>比反复累减相对计数更容易处理漂移和重排。</small></span><span><b>有序链表</b><small>实现简单，适合定时器数量很少的设备。</small></span><span><b>最小堆</b><small>快速找到最近到期项，适合动态数量较多的场景。</small></span><span><b>时间轮</b><small>适合粒度固定、数量较大的周期任务。</small></span><span><b>中断标记</b><small>到期时只转移状态或唤醒任务，不执行耗时逻辑。</small></span><span><b>取消与重启</b><small>必须定义回调正在执行时取消会产生什么结果。</small></span></div></figure>

## 到期不等于现在就执行回调

如果在 Tick 中断里执行网络发送、Flash 写入或复杂状态机，所有更高优先级中断都会被拖慢。中断应记录到期标记或投递事件；后台任务在可控上下文里执行回调。这样回调耗时、队列积压和失败处理都能观察到，也不会把定时器误写成隐藏的任务调度器。

## 回绕和竞态必须写进接口语义

硬件计数器会回绕，比较时间点时需要使用能处理有符号差值的方式，不能简单比较两个无符号整数大小。取消、重启和销毁定时器时，还要与中断和回调执行路径同步。一个清楚的接口会说明：取消成功后回调是否保证不再执行，还是只保证不会再次周期触发。

## 回绕比较有适用条件

对 32 位单调 tick，可用有符号差值判断是否到期，但前提是任意定时区间小于计数范围的一半。接口若允许更长超时，就要扩展计数位宽或在每次回绕时维护高位。

```c
static bool time_reached(uint32_t now, uint32_t deadline)
{
    return (int32_t)(now - deadline) >= 0;
}

void timer_isr(uint32_t now)
{
    while (heap_size() && time_reached(now, heap_min()->deadline)) {
        timer_t *timer = heap_pop();
        timer->state = TIMER_PENDING;
        enqueue_timer_event_from_isr(timer);
    }
}
```

回调开始前应把状态从 pending 原子地改成 running。取消函数遇到 running 时，是等待回调结束、返回 busy，还是只阻止下一周期，必须由接口文档固定。否则调用者释放回调参数后，后台任务仍可能访问旧地址。

周期定时器还要定义补偿方式。用“本次执行时刻加周期”会逐步积累回调延迟；用“上一次 deadline 加周期”能维持相位，但过载后可能连续补执行。控制任务通常需要限制追赶次数，并记录 missed deadline。

## 证据边界

本文没有给某种数据结构下绝对结论。定时器数量、注册频率、tick 粒度、回调上下文和 MCU 算力都会改变取舍。MultiTimer 是可参考实现，是否满足中断安全、回绕范围和取消语义，应以所用版本源码和目标负载测试为准。

参考：[MultiTimer](https://github.com/0x1abin/MultiTimer)
