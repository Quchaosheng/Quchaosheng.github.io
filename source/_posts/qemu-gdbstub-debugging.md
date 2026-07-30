---
title: QEMU gdbstub：从启动第一条指令调试系统
date: 2026-05-19 14:00:00
permalink: /2026/07/29/qemu-gdbstub-debugging/
categories: [技术, 调试]
tags: [QEMU, GDB, gdbstub]
---

QEMU 内置 gdbstub，可暂停虚拟 CPU 并通过远程协议让 GDB 查看寄存器、内存、断点和单步执行。它很适合调试固件、Bootloader 与早期内核，因为不需要等真实硬件复位，也可以稳定重现启动初期的状态。最常见的问题不是 GDB 命令，而是符号文件、加载地址和地址空间没有对齐。

<div class="note-flow"><span>QEMU 使用 -S -s 启动</span><i>→</i><span>GDB 加载带符号映像</span><i>→</i><span>target remote 连接</span><i>→</i><span>设置断点并继续</span><i>→</i><span>检查寄存器、页表和调用栈</span></div>

<figure class="note-visual"><figcaption><span>地址图</span>GDB 符号地址、QEMU 装载地址和当前虚拟地址必须说的是同一件事。</figcaption><div class="note-map"><span><b>-S</b><small>让虚拟 CPU 在复位后暂停，给 GDB 留出先连接的机会。</small></span><span><b>gdbstub 端口</b><small>QEMU 暴露远程协议端点，GDB 用 `target remote` 连接。</small></span><span><b>符号映像</b><small>ELF 提供函数和行号，不能只加载剥离符号后的二进制。</small></span><span><b>装载地址</b><small>Bootloader、内核和模块可能各自位于不同物理地址。</small></span><span><b>MMU 切换</b><small>开启分页后，断点和内存查看要区分虚拟、物理地址。</small></span><span><b>多 hart</b><small>确认当前 GDB thread 对应哪个 vCPU，避免看错寄存器。</small></span></div></figure>

## 先确认代码究竟被装到了哪里

`file` 加载 ELF 后，GDB 以 ELF 中的链接地址理解符号；若 QEMU 或 bootloader 把二进制放在别处，就需要按实际地址添加符号或调整链接脚本。出现“断点能下但永远不命中”“反汇编像乱码”时，先核对镜像加载地址、PC 和符号地址，而不是重复重启 QEMU。

## MMU 之前和之后是两种调试环境

早期固件通常直接使用物理地址；页表启用后，PC 和数据指针可能是虚拟地址。调试页表问题时，同时查看页表根、当前特权级、映射条目和 QEMU 的物理内存，逐级确认地址转换。多核系统还要明确哪个 hart 负责启动和哪个 hart 触发了异常，否则单步会落在错误上下文。

参考：[gdb 和 QEMU gdbstub 调试技巧](https://tinylab.org/gdb-and-qemu-gdbstub-debug/)
