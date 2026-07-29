---
title: Ftrace：Linux 内核函数跟踪是怎样工作的
date: 2026-07-29 13:56:00
categories: [技术, Linux内核]
tags: [Ftrace, tracefs, 可观测性]
---

Ftrace 是内核内置跟踪框架，可记录函数调用、调度、IRQ 和 tracepoint 事件。编译器在函数入口预留跟踪点，动态 ftrace 在启用时把 NOP 修改为调用跟踪桩。

<div class="note-flow"><span>编译时预留函数入口</span><i>→</i><span>启用 tracer/事件</span><i>→</i><span>动态修改跟踪点</span><i>→</i><span>事件写入 per-CPU ring buffer</span><i>→</i><span>trace-cmd 或 tracefs 读取</span></div>

function_graph tracer 能记录函数进入、退出与耗时；tracepoint 的接口比直接函数探针更稳定。生产环境应先限制 CPU、PID、函数和缓冲区大小，避免跟踪本身改变系统行为。

参考：[Ftrace 实现原理与开发实践](https://tinylab.org/ftrace-principle-and-practice/)
