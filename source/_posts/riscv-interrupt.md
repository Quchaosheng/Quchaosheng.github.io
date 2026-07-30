---
title: RISC-V 中断：从外设信号到处理函数
date: 2026-04-20 14:00:00
permalink: /2026/07/29/riscv-interrupt/
categories: [技术, 嵌入式Linux]
tags: [RISC-V, 中断, PLIC]
---

RISC-V 把异常和中断统称为 trap。核心本地中断通常包括软件中断与定时器中断，平台级外设中断则由 PLIC 等中断控制器汇聚、仲裁并投递到 hart。

## 外设中断路径

外设拉起中断源，PLIC 根据使能、优先级与阈值选择目标 hart。CPU 进入 trap 入口保存上下文，读取 cause，claim 中断号，调用设备处理函数，最后 complete 并返回。

<div class="note-flow"><span>外设产生中断</span><i>→</i><span>PLIC 仲裁与投递</span><i>→</i><span>CPU 进入 trap</span><i>→</i><span>claim 并处理 IRQ</span><i>→</i><span>complete 后返回</span></div>

## 记忆要点

- hart 是硬件线程，不一定等同于物理 CPU 核。
- trap vector、状态寄存器和 cause 决定入口与返回行为。
- 中断处理应尽量短，把可延后的工作交给线程化中断或其他下半部机制。

参考：[不懂 RISC-V 中断，难以吃透嵌入式底层编程](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247495022&idx=1&sn=62b0575d76e08ab5db211758e80d7ef9)
