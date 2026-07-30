---
title: Linux 信号：异步事件如何送达进程
date: 2026-05-03 14:00:00
permalink: /2026/07/29/linux-process-signals/
categories: [技术, Linux内核]
tags: [信号, 进程, 异步]
---

信号是内核向进程或线程报告异步事件的轻量机制，例如终端中断、子进程退出、非法内存访问和定时器到期。它适合通知“发生了什么”，不适合承载复杂数据或在回调里执行复杂业务。理解 pending、屏蔽和投递时机，才能避免看似偶发的竞态。

<div class="note-flow"><span>产生信号</span><i>→</i><span>加入 pending 集合</span><i>→</i><span>检查屏蔽字</span><i>→</i><span>执行默认动作或处理器</span><i>→</i><span>恢复执行</span></div>

<figure class="note-visual"><figcaption><span>投递图</span>信号先处于 pending 状态，解除屏蔽后才可能在合适的线程上处理。</figcaption><div class="note-map"><span><b>产生者</b><small>内核异常、终端、定时器、其他进程或线程都可产生信号。</small></span><span><b>pending 集合</b><small>传统信号同类可合并，实时信号可携带队列项。</small></span><span><b>屏蔽字</b><small>被屏蔽的信号保持 pending，不会立即调用处理器。</small></span><span><b>目标线程</b><small>进程信号和线程定向信号的投递范围不同。</small></span><span><b>默认动作</b><small>终止、停止、忽略或生成 core，取决于信号类型。</small></span><span><b>安全转交</b><small>处理器只设置标志或写入 fd，把复杂工作交回主循环。</small></span></div></figure>

## 处理器里只做异步信号安全的动作

信号可能在任意指令之间到达，若处理器调用 `malloc`、`printf`、普通锁或复杂库函数，可能正好重入被打断的内部状态。稳妥方式是用 `sigaction` 安装处理器，在其中设置 `sig_atomic_t` 标志或向预先准备的自管道写入一个字节；事件循环读到通知后，再在正常上下文处理退出、重载配置或回收子进程。

## 屏蔽范围要和临界区对应

多线程程序中，信号掩码是按线程维护的。需要由专门线程处理的信号可以先在所有线程中屏蔽，再用 `sigwait` 等方式同步接收。不要让多个线程随缘安装同一处理器并修改同一份全局状态，这会把异步问题变成更难复现的并发问题。

参考：[Linux 进程信号机制](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247484282&idx=1&sn=15a9f00bc81d60a1b2dd1f3798219d16)
