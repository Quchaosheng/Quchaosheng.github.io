---
title: rtla timerlat：定位实时系统的唤醒延迟
date: 2026-03-11 10:00:00
permalink: /2026/07/29/linux-rtla-timerlat/
categories: [技术, Linux实时]
tags: [rtla, timerlat, 实时Linux]
---

timerlat tracer 周期性设置定时器，测量定时器到期到中断处理、再到实时线程真正运行之间的延迟。它把“线程醒晚了”拆成两段：IRQ 延迟说明硬件事件和中断处理是否迟到，线程延迟说明唤醒后又在调度器和其他工作里等了多久。

<div class="note-flow"><span>设置周期定时器</span><i>→</i><span>定时器到期</span><i>→</i><span>记录 IRQ 延迟</span><i>→</i><span>唤醒 timerlat 线程</span><i>→</i><span>记录线程延迟并追踪干扰源</span></div>

<figure class="note-visual"><figcaption><span>延迟图</span>先判断尖峰发生在中断前还是线程被唤醒后，再决定追踪方向。</figcaption><div class="note-map"><span><b>理想到期点</b><small>测试的时间基准，后续差值都从这里计算。</small></span><span><b>IRQ 延迟</b><small>到期到相关中断处理开始的差，指向中断屏蔽或硬件干扰。</small></span><span><b>线程延迟</b><small>中断唤醒到测试线程实际运行的差，指向调度和竞争。</small></span><span><b>CPU 亲和性</b><small>固定观测 CPU，避免迁移把不同核心的噪声混在一起。</small></span><span><b>追踪阈值</b><small>超过阈值才保留详细 trace，避免长期采集淹没磁盘。</small></span><span><b>关联记录</b><small>同时保存 IRQ、调度、温度、频率和业务负载信息。</small></span></div></figure>

## 两个数字指向不同的排查路径

若 IRQ 延迟本身很大，优先检查硬中断被屏蔽、长中断、固件活动、深度 idle 退出或不可抢占路径。若 IRQ 延迟正常而线程延迟很大，关注实时优先级、CPU 隔离、锁竞争、软中断、后台线程和运行队列。把两者混成一个“最大延迟”会让排查只能靠猜。

## 测量条件要冻结，阈值要能解释

测试前记录内核版本、PREEMPT_RT 状态、启动参数、测试 CPU、IRQ 分布、频率 governor 和负载。长期运行时只在超出阈值后触发 trace，并保留尖峰前后的时间窗口。发现一次异常后，修改一个变量、在相同工况复测，才能判断它是否真的削掉了尾延迟。

参考：[rtla timerlat 延迟测试原理](https://tinylab.org/linux-rtla-2/)
