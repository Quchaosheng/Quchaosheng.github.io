---
title: EEVDF：从公平调度到虚拟截止时间
date: 2026-07-29 16:09:18
source_checked_at: 2026-07-29 16:09:18
permalink: /2026/07/29/linux-eevdf-scheduler/
categories: [技术, Linux内核]
tags: [EEVDF, 调度器, Linux]
---

EEVDF（Earliest Eligible Virtual Deadline First）在公平的基础上引入“可运行资格”和“虚拟截止时间”。它既关注任务是否欠 CPU 时间，也关注任务本次请求何时应该完成。

## 选择逻辑

调度器先从可运行任务中判断哪些已满足 eligibility，再选择虚拟截止时间最早者。较短的时间片会得到较早的虚拟截止时间，因此交互型任务可获得更低延迟，同时长期权重公平仍然保留。

<div class="note-flow"><span>计算任务 lag</span><i>→</i><span>筛选 eligible 任务</span><i>→</i><span>计算虚拟截止时间</span><i>→</i><span>运行截止时间最早者</span></div>

## 记忆要点

- `lag` 表示任务相对公平份额是超前还是落后。
- eligibility 防止已经超额运行的任务继续抢占资源。
- virtual deadline 把延迟诉求纳入选择，而不是只比较 vruntime。

一句话回答：**EEVDF 用 lag 保公平，用虚拟截止时间改善响应延迟。**

参考：[不懂 EEVDF 调度器，别再说你懂 Linux 内核了](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494601&idx=1&sn=28033289323ccab803c6d09a321f5d55)
