---
title: QEMU gdbstub：从启动第一条指令调试系统
date: 2026-05-19 14:00:00
permalink: /2026/07/29/qemu-gdbstub-debugging/
categories: [技术, 调试]
tags: [QEMU, GDB, gdbstub]
---

QEMU 内置 gdbstub，可暂停虚拟 CPU 并通过远程协议让 GDB 查看寄存器、内存、断点和单步执行，适合调试固件、Bootloader 与早期内核。

<div class="note-flow"><span>QEMU 使用 -S -s 启动</span><i>→</i><span>GDB 加载带符号映像</span><i>→</i><span>target remote 连接</span><i>→</i><span>设置断点并继续</span><i>→</i><span>检查寄存器、页表和调用栈</span></div>

必须让符号文件、加载地址和实际映像匹配；启用地址随机化或 MMU 后，还要处理虚拟地址与物理地址的转换。多核调试应确认当前 thread/hart。

参考：[gdb 和 QEMU gdbstub 调试技巧](https://tinylab.org/gdb-and-qemu-gdbstub-debug/)
