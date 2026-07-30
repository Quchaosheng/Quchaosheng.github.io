---
title: cyclictest：怎样测量 Linux 实时调度延迟
date: 2026-07-30 09:07:00
categories: [技术, Linux实时]
tags: [cyclictest, 延迟测试, rt-tests]
---

cyclictest 使用高优先级线程周期睡眠，比较计划唤醒时间与实际运行时间，统计最小、平均和最大延迟。

<div class="note-flow"><span>设置实时优先级与 CPU</span><i>→</i><span>绝对时间睡眠</span><i>→</i><span>定时器到期唤醒</span><i>→</i><span>计算实际偏差</span><i>→</i><span>长期记录最大值</span></div>

测试必须同时施加 CPU、内存、I/O 与网络压力；一次空闲测试的漂亮数字没有代表性。参考：[rt-tests](https://git.kernel.org/pub/scm/utils/rt-tests/rt-tests.git/)
