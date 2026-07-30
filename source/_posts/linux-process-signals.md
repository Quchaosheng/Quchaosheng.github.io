---
title: Linux 信号：异步事件如何送达进程
date: 2026-05-03 14:00:00
permalink: /2026/07/29/linux-process-signals/
categories: [技术, Linux内核]
tags: [信号, 进程, 异步]
---

信号是内核向进程或线程报告异步事件的轻量机制，例如终端中断、子进程退出、非法内存访问和定时器到期。

<div class="note-flow"><span>产生信号</span><i>→</i><span>加入 pending 集合</span><i>→</i><span>检查屏蔽字</span><i>→</i><span>执行默认动作或处理器</span><i>→</i><span>恢复执行</span></div>

传统信号同类可能合并，实时信号可排队。处理函数中只能调用异步信号安全函数；复杂逻辑应通过自管道、eventfd 或标志位转交正常执行流。`sigaction` 比旧 `signal` 接口更可靠。

参考：[Linux 进程信号机制](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247484282&idx=1&sn=15a9f00bc81d60a1b2dd1f3798219d16)
