---
title: Linux 高精度定时器：实时任务为何不再依赖系统节拍
date: 2026-06-30 14:00:00
permalink: /2026/07/30/linux-high-resolution-timers/
categories: [技术, Linux实时]
tags: [hrtimer, 高精度定时器, clockevent]
---

一个周期任务若每 1 ms 运行一次，最直观的写法是“睡 1 ms，再做一次工作”。但如果每轮工作多花了 80 微秒，下一轮又从当前时刻开始睡，误差会不断累积，最终周期已经悄悄漂移。Linux 的高精度定时器（hrtimer）配合硬件 clock event，可以把到期时刻表达为绝对时间，并按下一次最近到期事件编程硬件定时器。它解决的是“什么时候该触发”，不是“触发后什么时候一定能拿到 CPU”。

<div class="note-flow"><span>任务设置到期时间</span><i>→</i><span>hrtimer 入队排序</span><i>→</i><span>编程 clock event</span><i>→</i><span>定时中断触发回调</span><i>→</i><span>唤醒任务并参与调度</span></div>

## clocksource、clockevent 与 hrtimer 各管什么

这三个名词很容易混。**clocksource** 是“现在几点”的高质量计时来源，例如 TSC 或架构计数器；**clockevent** 是“到某个时刻叫醒我”的硬件事件设备；**hrtimer** 则是内核把多个高精度定时请求排队、选择最近到期项的通用机制。用户态的 `clock_nanosleep`、POSIX timer 等接口最终会依赖这条路径。

<div class="note-map"><span><b>clocksource</b><small>读取当前时间，要求单调、稳定且精度足够</small></span><span><b>clockevent</b><small>为下一次到期事件编程中断，负责“叫醒”</small></span><span><b>hrtimer</b><small>按到期时间管理软件定时器，选择最近 deadline</small></span><span><b>定时器到期</b><small>只说明回调/唤醒可以发生，尚未保证线程运行</small></span><span><b>调度器</b><small>决定被唤醒的线程何时真的占用 CPU</small></span><span><b>干扰来源</b><small>IRQ、不可抢占区、锁、CPU 频率和固件都会拉长后半段</small></span></div>

高精度不等于无限精度。硬件定时器有分辨率和编程成本，内核还会受中断屏蔽、CPU 深度休眠与虚拟化影响。对实时工程而言，最重要的是将“定时器到期延迟”和“线程调度延迟”分开测量。

## 为什么周期任务应使用绝对时间

相对睡眠将本轮计算时间累加进下一轮周期；绝对睡眠则始终追赶同一条时间轴。用户态通常可用 `CLOCK_MONOTONIC` 和 `TIMER_ABSTIME` 实现，避免被系统时间校正影响。

```c
struct timespec next = now_monotonic();
const long period_ns = 1000000;  // 1 ms

for (;;) {
    add_ns(&next, period_ns);
    clock_nanosleep(CLOCK_MONOTONIC, TIMER_ABSTIME, &next, NULL);
    run_control_step();
}
```

实际代码还要定义“错过一个周期怎么办”：连续超时后是跳过过期周期、连续补算，还是进入安全状态？不同控制系统的正确答案并不相同，但不能默认悄悄累积延迟。

## 如何把问题定位到正确一段

`cyclictest` 适合量整体唤醒偏差；`rtla timerlat` 能进一步区分定时器/IRQ 延迟和线程延迟。如果定时器按时触发、线程却迟迟不运行，应检查调度、IRQ 亲和性和 CPU 隔离；如果定时器本身就晚，则关注 clockevent、深度 idle、固件或平台时间源。

建立基线时，固定时钟源、CPU 亲和性、功耗模式和测试时长。不要用 `sleep()` 的平均时间推断实时能力，也不要把一个纳秒级 API 名称误解成整个系统具有纳秒级 deadline 保证。

参考：[High resolution timers and dynamic ticks](https://docs.kernel.org/timers/highres.html) · [clock_nanosleep(2)](https://man7.org/linux/man-pages/man2/clock_nanosleep.2.html)
