---
title: Linux 实时系统落地检查清单
date: 2026-06-29 20:00:00
permalink: /2026/07/30/realtime-linux-checklist/
categories: [技术, Linux实时]
tags: [实时Linux, 调优, 验证]
---

实时化不是“装一个 PREEMPT_RT 内核，再把线程优先级调到 99”。一个可交付的实时系统必须能回答：哪个任务多久运行一次、最晚何时完成、在什么工况下仍然成立、失败时做什么、由什么数据证明。只有把需求、平台、软件、观测和验收连起来，调优才不会沦为一次偶然的 benchmark。

<div class="note-flow"><span>定义 deadline 与最坏延迟</span><i>→</i><span>配置 PREEMPT_RT 与调度</span><i>→</i><span>隔离 CPU/IRQ/内存</span><i>→</i><span>施加组合压力测试</span><i>→</i><span>追踪尖峰并形成回归基线</span></div>

## 从需求写出可验收的数字

先避免“系统要实时”这种无法测试的说法。对每条关键链路写出周期、截止期、最坏执行时间、最大允许抖动、丢帧/超时策略和安全后果。例如：控制线程每 1 ms 一次，业务计算必须在 300 微秒内结束；若连续两次超时，控制器进入安全减速；感知结果超过 200 ms 则不能参与规划。

<div class="note-map"><span><b>需求</b><small>周期、deadline、抖动、失败后的安全动作</small></span><span><b>平台</b><small>RT 内核、BIOS、功耗、NIC、设备 firmware</small></span><span><b>资源布局</b><small>CPU、IRQ、内存、缓存、网络队列的归属</small></span><span><b>应用设计</b><small>调度策略、锁、内存、超时、看门狗和降级</small></span><span><b>观测证据</b><small>cyclictest、rtla、trace、业务时间戳与环境日志</small></span><span><b>回归基线</b><small>相同负载下可比较的直方图、阈值和失败产物</small></span></div>

## 一份分层检查表

| 层次 | 要确认的内容 | 常见遗漏 |
| --- | --- | --- |
| 内核 | PREEMPT_RT、配置、启动参数、版本锁定 | 只看发行版名字，不看实际 config |
| CPU/IRQ | 关键线程亲和性、housekeeping、IRQ/softirq 布局 | 忘了 `irqbalance`、workqueue 与共享缓存 |
| 内存 | `mlockall`、预触碰、固定容量、memlock 限制 | 实时循环里仍有 `malloc`、日志和 COW |
| 调度与锁 | FIFO/RR/DEADLINE 选择、优先级、锁协议、watchdog | 用 FIFO 99 掩盖长临界区 |
| I/O 与网络 | 驱动延迟、队列、时间戳、PTP/TSN 需求 | 只测本机，不测端到端帧年龄 |
| 平台 | BIOS、频率、C-state、温度、SMI、firmware | 空载时合格，热稳定后失效 |

## 验收必须有对抗负载

空载的最小延迟只能作为基线。验收应按矩阵施加 CPU、内存、磁盘、网络、相机/GPU 或现场总线负载，并包含低温到热稳定、服务重启、设备拔插、网络切换和模型/配置更新等事件。每轮测试记录时间、版本、温度、CPU 规划、IRQ 布局、原始直方图和异常 trace。

```text
通过条件 = 最大值阈值 + 高分位阈值 + 连续运行时长
         + 业务端到端 deadline + 失败时的安全动作验证
```

只保存一个“最好结果”没有意义。需要保存原始数据和失败证据，才能在内核升级、驱动更新、BIOS 改动或容器迁移后发现回归。

## 遇到尖峰时的排障顺序

1. 先确认尖峰是系统唤醒延迟、业务计算超时，还是传感器数据已经过期。
2. 固定发生时刻和 CPU，关联 `rtla timerlat/osnoise`、ftrace、`/proc/interrupts`、内存/频率与应用日志。
3. 一次只修改一个变量，例如某个 IRQ 亲和性或 C-state 策略。
4. 在相同负载、相同时间长度下复测，确认最大值和分布都改善。
5. 将变化、原因和新基线写进版本库，让下一次问题可以追溯。

实时系统最终交付的不是一张最低延迟截图，而是一条能被复现、被监控、失败时仍有安全行为的工程链路。

参考：[Linux Foundation Real-Time Linux](https://wiki.linuxfoundation.org/realtime/start) · [rtla](https://docs.kernel.org/tools/rtla/index.html)
