---
title: 进程睡眠与唤醒：等待队列避免忙等
date: 2026-07-29 13:40:00
categories: [技术, Linux内核]
tags: [等待队列, 睡眠, 唤醒]
---

当资源暂不可用时，内核将任务挂入等待队列并设置为可中断或不可中断睡眠；事件发生后，生产者唤醒合适的等待者，调度器再决定何时运行。

<div class="note-flow"><span>检查条件不满足</span><i>→</i><span>加入等待队列</span><i>→</i><span>设置任务睡眠</span><i>→</i><span>事件发生并 wake_up</span><i>→</i><span>重新检查条件</span></div>

必须“先登记等待者，再检查条件”或使用正确的辅助宏，避免检查与睡眠之间丢失唤醒。被唤醒不代表条件一定成立，仍要循环检查。

参考：[Linux 进程睡眠与唤醒](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247485407&idx=1&sn=a295c8454acd64e1e76d7c261dd81d5a)
