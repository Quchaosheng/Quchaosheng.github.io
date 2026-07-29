---
title: 事件驱动状态机：让裸机程序摆脱超级循环
date: 2026-07-29 14:17:00
categories: [技术, 嵌入式]
tags: [状态机, 事件驱动, 裸机]
---

事件驱动架构把中断、定时器和输入转换为事件，由状态机根据当前状态执行短小动作，避免在一个循环中堆叠阻塞延时和隐式状态。

<div class="note-flow"><span>中断/定时器产生事件</span><i>→</i><span>事件入队</span><i>→</i><span>调度器分发</span><i>→</i><span>状态机执行转换</span><i>→</i><span>输出动作并等待下一事件</span></div>

参考：[EFSM](https://gitee.com/simpost/EFSM)
