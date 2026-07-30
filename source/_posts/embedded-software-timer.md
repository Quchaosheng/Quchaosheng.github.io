---
title: 软件定时器：用一个硬件时基管理多个超时
date: 2026-06-28 14:00:00
permalink: /2026/07/29/embedded-software-timer/
categories: [技术, 嵌入式]
tags: [软件定时器, Tick, 调度]
---

软件定时器把多个到期时间组织在有序表、最小堆或时间轮中，由统一时基推进并执行到期回调。

<div class="note-flow"><span>注册超时与回调</span><i>→</i><span>插入定时器结构</span><i>→</i><span>Tick/硬件比较到期</span><i>→</i><span>取出到期项</span><i>→</i><span>任务上下文执行回调</span></div>

中断中只标记到期，耗时回调放到任务中；还要处理计数器回绕和取消竞态。参考：[MultiTimer](https://github.com/0x1abin/MultiTimer)
