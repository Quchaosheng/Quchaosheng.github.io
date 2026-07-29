---
title: Cortex-M 故障回溯：从 HardFault 找到出错代码
date: 2026-07-29 14:19:00
categories: [技术, 嵌入式]
tags: [HardFault, Cortex-M, CmBacktrace]
---

异常入口会把部分寄存器压栈。故障处理程序读取栈帧、SCB 故障状态寄存器和链接地址，再结合 ELF 符号恢复调用路径。

<div class="note-flow"><span>CPU 进入 HardFault</span><i>→</i><span>识别 MSP/PSP 栈帧</span><i>→</i><span>保存寄存器和故障状态</span><i>→</i><span>地址映射到符号</span><i>→</i><span>复现并修复根因</span></div>

参考：[CmBacktrace](https://github.com/armink/CmBacktrace)
