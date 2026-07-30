---
title: FinSH：RT-Thread 的交互式诊断 Shell
date: 2026-07-30 09:04:00
categories: [技术, RT-Thread]
tags: [FinSH, Shell, 调试]
---

FinSH 把函数或命令导出到命令表，通过串口控制台解析输入并调用对应处理函数，适合查看线程、内存、设备状态和执行现场诊断。

<div class="note-flow"><span>串口收到命令</span><i>→</i><span>FinSH 解析参数</span><i>→</i><span>查找导出命令</span><i>→</i><span>执行诊断函数</span><i>→</i><span>输出结果</span></div>

量产固件应控制命令权限，避免暴露改写 Flash、密钥或任意内存访问能力。参考：[RT-Thread](https://github.com/RT-Thread/rt-thread)
