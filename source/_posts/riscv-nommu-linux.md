---
title: RISC-V Non-MMU Linux：没有虚拟内存怎样运行应用
date: 2026-05-20 14:00:00
permalink: /2026/07/29/riscv-nommu-linux/
categories: [技术, RISC-V]
tags: [Non-MMU, uClinux, RISC-V]
---

Non-MMU Linux 面向没有地址转换单元的处理器。内核与应用直接使用物理地址，无法获得常规进程的地址空间隔离、按需分页和写时复制。

<div class="note-flow"><span>Bootloader 装载内核</span><i>→</i><span>建立物理内存分区</span><i>→</i><span>加载 flat/FDPIC 应用</span><i>→</i><span>直接在物理地址执行</span><i>→</i><span>系统调用进入内核</span></div>

因为不能依赖 COW，`fork` 很受限制，通常使用 `vfork + exec`。应用必须支持可重定位格式，内存碎片与越界破坏也更难隔离。优势是硬件和内核配置更小，适合资源受限设备。

参考：[RISC-V Non-MMU Linux](https://tinylab.org/riscv-non-mmu-linux-part1/)
