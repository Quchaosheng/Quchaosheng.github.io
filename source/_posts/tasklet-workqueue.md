---
title: Tasklet 与工作队列：中断下半部怎样选
date: 2026-07-29 14:11:00
categories: [技术, Linux内核]
tags: [工作队列, Tasklet, 中断]
---

下半部把非紧急工作从硬中断移出。tasklet 运行在软中断上下文，不能睡眠；工作队列由内核线程执行，可以阻塞并使用多数普通内核接口。

<div class="note-flow"><span>硬中断确认设备</span><i>→</i><span>清除中断并保存最少状态</span><i>→</i><span>调度下半部</span><i>→</i><span>tasklet 快速处理或 workqueue 可睡眠处理</span></div>

新代码通常优先线程化中断或工作队列。取消工作时要同步处理正在运行的回调，避免设备释放后发生 use-after-free。

参考：[中断处理的工作队列机制](https://www.kerneltravel.net/blog/2020/interrupt_tasklet_hds/)
