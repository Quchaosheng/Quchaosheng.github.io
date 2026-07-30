---
title: RISC-V Non-MMU Linux：没有虚拟内存怎样运行应用
date: 2026-05-20 14:00:00
permalink: /2026/07/29/riscv-nommu-linux/
categories: [技术, RISC-V]
tags: [Non-MMU, uClinux, RISC-V]
---

Non-MMU Linux 面向没有地址转换单元的处理器。内核与应用直接使用物理地址，因此无法获得常规进程地址空间隔离、按需分页和写时复制。它仍能提供任务、文件、网络和系统调用，但应用的内存安全边界、装载格式和进程创建方式都与带 MMU 的 Linux 不同。

<div class="note-flow"><span>Bootloader 装载内核</span><i>→</i><span>建立物理内存分区</span><i>→</i><span>加载 flat/FDPIC 应用</span><i>→</i><span>直接在物理地址执行</span><i>→</i><span>系统调用进入内核</span></div>

<figure class="note-visual"><figcaption><span>地址图</span>没有 MMU 时，软件约束和装载布局要承担原本由页表提供的一部分责任。</figcaption><div class="note-map"><span><b>物理内存</b><small>内核、应用、DMA 和缓冲区直接共享同一地址空间。</small></span><span><b>内存分区</b><small>链接脚本和装载器必须避免区域重叠，不能依赖页表兜底。</small></span><span><b>flat/FDPIC</b><small>应用需要适合无 MMU 环境的可装载或可重定位格式。</small></span><span><b>fork 限制</b><small>没有 COW 时复制完整地址空间代价很高或不可行。</small></span><span><b>vfork + exec</b><small>常用创建路径，父子共享期间必须遵守严格约束。</small></span><span><b>故障影响</b><small>一次越界写可能破坏其他任务甚至内核，隔离能力有限。</small></span></div></figure>

## 程序装载和链接是系统设计的一部分

带 MMU 系统可以把每个进程映射到独立虚拟地址空间；Non-MMU 系统需要由 bootloader、链接脚本和装载器明确安排代码、数据、栈、堆和 DMA 缓冲区。应用格式要支持在可用位置运行，动态链接和共享库的使用也会受到更多限制。内存布局一旦设计不清楚，问题通常会表现为看似随机的互相覆盖。

## 资源小不等于风险小

Non-MMU 可以降低硬件复杂度和部分内核开销，适合资源受限且运行软件受控的场景。但它不能把不可信应用安全地隔离开，也不能靠内核阻止所有越界。对网络输入、协议解析和升级包要采取更严格的边界检查；调试时也应记录内存布局和任务栈水位，尽早发现覆盖风险。

参考：[RISC-V Non-MMU Linux](https://tinylab.org/riscv-non-mmu-linux-part1/)
