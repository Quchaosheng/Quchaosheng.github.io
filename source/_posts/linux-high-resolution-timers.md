---
title: Linux 高精度定时器：实时任务为何不再依赖系统节拍
date: 2026-07-30 09:20:00
categories: [技术, Linux实时]
tags: [hrtimer, 高精度定时器, clockevent]
---

传统定时器受内核节拍粒度限制，`hrtimer` 则用红黑树按到期时间排序，并由高精度 clock event 设备安排下一次中断。它让纳秒级接口具备更细的触发粒度，但最终唤醒时间仍会受到中断关闭、调度竞争和硬件计时器精度影响。
<div class="note-flow"><span>任务设置到期时间</span><i>→</i><span>hrtimer 入队排序</span><i>→</i><span>编程 clock event</span><i>→</i><span>定时中断触发回调</span><i>→</i><span>唤醒任务并参与调度</span></div>

实时程序应使用单调时钟和绝对时间周期，避免处理耗时不断累积为漂移。高精度定时器解决的是“何时到期”，不能单独保证“何时得到 CPU”。参考：[High resolution timers and dynamic ticks](https://docs.kernel.org/timers/highres.html)
