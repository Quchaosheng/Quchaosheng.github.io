---
title: 软件定时器：用一个硬件时基管理多个超时
date: 2026-06-28 14:00:00
permalink: /2026/07/29/embedded-software-timer/
categories: [技术, 嵌入式]
tags: [软件定时器, Tick, 调度]
---

一个 MCU 的硬件定时器数量有限，但超时需求很多：按键长按、通信重试、传感器采样、状态机等待和看门狗监督都需要各自的截止时间。软件定时器把这些截止时间组织到统一数据结构中，由一个时基推进；关键在于选择合适的结构，并把“发现到期”和“执行回调”分开。

<div class="note-flow"><span>注册超时与回调</span><i>→</i><span>插入定时器结构</span><i>→</i><span>Tick/硬件比较到期</span><i>→</i><span>取出到期项</span><i>→</i><span>任务上下文执行回调</span></div>

<figure class="note-visual"><figcaption><span>时间图</span>定时器数据结构负责排序，到期回调由安全的执行上下文负责。</figcaption><div class="note-map"><span><b>绝对到期点</b><small>比反复累减相对计数更容易处理漂移和重排。</small></span><span><b>有序链表</b><small>实现简单，适合定时器数量很少的设备。</small></span><span><b>最小堆</b><small>快速找到最近到期项，适合动态数量较多的场景。</small></span><span><b>时间轮</b><small>适合粒度固定、数量较大的周期任务。</small></span><span><b>中断标记</b><small>到期时只转移状态或唤醒任务，不执行耗时逻辑。</small></span><span><b>取消与重启</b><small>必须定义回调正在执行时取消会产生什么结果。</small></span></div></figure>

## 到期不等于现在就执行回调

如果在 Tick 中断里执行网络发送、Flash 写入或复杂状态机，所有更高优先级中断都会被拖慢。中断应记录到期标记或投递事件；后台任务在可控上下文里执行回调。这样回调耗时、队列积压和失败处理都能观察到，也不会把定时器误写成隐藏的任务调度器。

## 回绕和竞态必须写进接口语义

硬件计数器会回绕，比较时间点时需要使用能处理有符号差值的方式，不能简单比较两个无符号整数大小。取消、重启和销毁定时器时，还要与中断和回调执行路径同步。一个清楚的接口会说明：取消成功后回调是否保证不再执行，还是只保证不会再次周期触发。

参考：[MultiTimer](https://github.com/0x1abin/MultiTimer)
