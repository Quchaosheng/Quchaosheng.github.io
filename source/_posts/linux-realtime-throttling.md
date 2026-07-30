---
title: Linux 实时节流：SCHED_FIFO 为什么会突然让出 CPU
date: 2026-07-30 09:22:00
categories: [技术, Linux实时]
tags: [SCHED_FIFO, 实时节流, sched_rt_runtime_us]
---

实时线程若不阻塞，可能永久占用 CPU。Linux 默认用 `sched_rt_period_us` 定义统计周期，用 `sched_rt_runtime_us` 限制该周期内实时调度类可使用的时间，预算耗尽后会暂时节流，为普通任务和系统维护保留运行机会。
<div class="note-flow"><span>实时线程开始运行</span><i>→</i><span>消耗 RT 运行预算</span><i>→</i><span>达到周期上限</span><i>→</i><span>实时类被暂时节流</span><i>→</i><span>下个周期补充预算</span></div>

遇到规律性的毫秒级停顿，应检查内核日志与这两个 sysctl，而不是只提高优先级。关闭节流会放大失控实时线程冻结系统的风险，生产环境必须配套看门狗与 CPU 分区。参考：[Scheduler sysctl documentation](https://docs.kernel.org/admin-guide/sysctl/kernel.html#sched-rt-period-us-and-sched-rt-runtime-us)
