---
title: CPU 频率与空闲态：实时延迟中容易忽略的硬件变量
date: 2026-07-30 09:23:00
categories: [技术, Linux实时]
tags: [cpufreq, cpuidle, C-state]
---

动态调频会改变任务完成时间，深度 C-state 则需要更长的退出过程。二者能显著降低功耗，却会给实时路径加入与负载、温度和固件策略相关的可变延迟，因此测试结果可能平均值很好、偶尔却出现长尾。
<div class="note-flow"><span>CPU 负载下降</span><i>→</i><span>降低频率或进入深度空闲</span><i>→</i><span>实时事件到来</span><i>→</i><span>硬件恢复频率与状态</span><i>→</i><span>任务开始执行</span></div>

调优时应先测量各状态的影响，再决定固定 performance governor、限制深度空闲或接受功耗与延迟折中；不要把实验配置直接当成产品配置。参考：[CPU Performance Scaling](https://docs.kernel.org/admin-guide/pm/cpufreq.html) · [CPU Idle Time Management](https://docs.kernel.org/admin-guide/pm/cpuidle.html)
