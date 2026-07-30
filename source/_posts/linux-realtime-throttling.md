---
title: Linux 实时节流：SCHED_FIFO 为什么会突然让出 CPU
date: 2026-07-30 09:22:00
categories: [技术, Linux实时]
tags: [SCHED_FIFO, 实时节流, sched_rt_runtime_us]
---

`SCHED_FIFO` 线程若从不阻塞，可以永远占着一个 CPU。对控制环而言这似乎很诱人，对整台 Linux 机器却很危险：同核上的内核维护、SSH、日志、网络处理甚至恢复机制都可能没有机会运行。Linux 因此提供实时节流机制，用一个统计周期和其中可供实时调度类使用的运行预算，为普通任务和系统维护留出 CPU 时间。

<div class="note-flow"><span>实时线程开始运行</span><i>→</i><span>消耗 RT 运行预算</span><i>→</i><span>达到周期上限</span><i>→</i><span>实时类被暂时节流</span><i>→</i><span>下个周期补充预算</span></div>

## 两个 sysctl 的含义

`kernel.sched_rt_period_us` 定义预算统计的周期；`kernel.sched_rt_runtime_us` 定义在该周期内，RT 调度类最多可消耗多少时间。预算耗尽后，实时任务会在本周期剩余时间内被限制，直到新的周期开始。这个行为常表现为一个高优先级线程“明明没有阻塞，却规律性停顿”。

<div class="note-map"><span><b>RT period</b><small>计算实时 CPU 使用量的统计窗口</small></span><span><b>RT runtime</b><small>该窗口内允许实时调度类消耗的总预算</small></span><span><b>预算耗尽</b><small>实时任务暂时不能继续压住普通调度类</small></span><span><b>剩余 CPU</b><small>供内核杂务、普通服务、网络与恢复路径运行</small></span><span><b>下个周期</b><small>预算重新开始计算，实时类恢复竞争资格</small></span><span><b>设计目标</b><small>防止错误 RT 线程把整机变成不可管理状态</small></span></div>

先读取实际值，而不要假设每个发行版和内核的默认配置都一样：

```bash
sysctl kernel.sched_rt_period_us
sysctl kernel.sched_rt_runtime_us
dmesg | grep -i -E 'sched|throttl'
```

若应用出现周期性长停顿，先确认是否是 RT 节流，再去改优先级或定时器。用更高优先级无法绕过同一 CPU 的总预算。

## 为什么不要轻易关闭节流

把 `sched_rt_runtime_us` 设为 `-1` 会关闭全局 RT 节流，但这应该只出现在经过充分风险评估的专用系统中。一个无限循环的 FIFO 线程可能让你无法登录机器去修复它；CPU 隔离也只能保护其他核心，保护不了它所在的控制核心和依赖服务。

更稳妥的做法是让周期任务在每轮结束后明确阻塞或等待绝对时间，限制单次最坏执行时间，设置软件 watchdog，并为系统服务保留 housekeeping CPU。若确实需要很高的实时占比，应在控制器、独立核或独立硬件上承接最危险的闭环。

## 如何验证预算与业务模型匹配

为每个实时线程记录实际运行时间、等待时间和错过周期次数。然后在 CPU 压力、网络风暴、日志写入和异常重启场景下观察节流是否发生。若预算耗尽是可预期的，应把它纳入业务状态机；若不应发生，就说明 CPU 利用率估计、线程绑定或后台工作存在问题。

实时节流看上去像性能限制，其实是一项故障隔离机制。只有在明确知道“失控时机器如何恢复”的前提下，才值得讨论是否放宽它。

参考：[Scheduler sysctl documentation](https://docs.kernel.org/admin-guide/sysctl/kernel.html#sched-rt-period-us-and-sched-rt-runtime-us) · [sched(7)](https://man7.org/linux/man-pages/man7/sched.7.html)
