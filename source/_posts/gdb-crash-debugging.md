---
title: GDB 崩溃调试：从信号到调用栈
date: 2026-07-29 13:13:00
categories: [技术, 调试]
tags: [GDB, CoreDump, 崩溃分析]
---

崩溃调试的目标不是盯着最后一行代码，而是还原“异常信号、出错线程、调用路径、关键变量和内存状态”这条证据链。

## 排查路径

开启 core dump 并保留与二进制匹配的调试符号。使用 `gdb program core` 后先看信号与全部线程，再定位故障栈帧，检查参数、局部变量、寄存器和相关内存。

<div class="note-flow"><span>程序收到致命信号</span><i>→</i><span>内核生成 core</span><i>→</i><span>加载二进制与符号</span><i>→</i><span>定位异常线程和栈帧</span><i>→</i><span>验证变量与内存</span></div>

## 常用命令

- `thread apply all bt full`：查看全部线程调用栈。
- `frame`、`info locals`、`info args`：检查目标栈帧。
- `x`、`p`、`info registers`：查看内存、表达式和寄存器。

优化会导致内联、变量消失和执行顺序变化，必要时用可复现输入和 sanitizers 交叉验证。

参考：[深入 GDB 调试原理，拆解程序崩溃内核](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494945&idx=1&sn=9dffabf351197d5418549c39e4ee7202)
