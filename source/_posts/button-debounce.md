---
title: 按键消抖：从电气抖动到可靠事件
date: 2026-06-29 14:00:00
permalink: /2026/07/29/button-debounce/
categories: [技术, 嵌入式]
tags: [按键, 消抖, 事件]
---

机械按键不会在按下的一瞬间稳定地从 0 变成 1。触点会在数毫秒内反复导通、断开；如果业务直接消费 GPIO 边沿，就会把一次按键误判成多次点击。消抖的目标是把这段不稳定的电平变成一个明确的按下事件和一个明确的释放事件。

<div class="note-flow"><span>周期采样 GPIO</span><i>→</i><span>更新稳定计数</span><i>→</i><span>超过阈值确认状态</span><i>→</i><span>计算按压时长</span><i>→</i><span>发布按键事件</span></div>

<figure class="note-visual"><figcaption><span>状态图</span>采样值、候选状态和业务事件不要混在一起。</figcaption><div class="note-map"><span><b>原始电平</b><small>GPIO 边沿可能连续抖动，不能直接作为事件。</small></span><span><b>候选状态</b><small>连续采到同一个值时，才累加稳定计数。</small></span><span><b>确认状态</b><small>计数达到阈值后，逻辑状态才真正改变。</small></span><span><b>按下时刻</b><small>确认按下时记录时间，供长按和连击判断使用。</small></span><span><b>释放时刻</b><small>确认释放时计算持续时间，不把抖动算进去。</small></span><span><b>业务事件</b><small>只向上层发 press、release、long-press 等稳定事件。</small></span></div></figure>

## 采样算法要保存两个状态

实现时至少保存 `raw`、`candidate` 和 `stable` 三个概念。`raw` 是本次读取到的电平；它连续等于 `candidate` 时增加计数，否则替换候选值并重新计数。只有计数达到阈值，且候选值与 `stable` 不同时，才更新已确认状态并发出事件。这样释放时也会经过同一套逻辑，不会只处理按下抖动。

阈值由采样周期和按键手感共同决定。例如每 1 ms 采样、连续 8 次一致才确认，理论上的稳定时间约为 8 ms。这个时间不应写死在业务代码里，应允许针对不同面板和按键调整。

## 中断只负责叫醒，确认仍在任务里完成

GPIO 中断很适合把系统从低功耗状态叫醒，或通知任务开始密集采样。但中断中不要直接判定单击，更不要在中断里执行长按回调。把边沿记成一个轻量通知，后续由定时器或任务完成采样、状态转换和事件分发，调试时也更容易复现问题。

参考：[MultiButton](https://github.com/0x1abin/MultiButton)
