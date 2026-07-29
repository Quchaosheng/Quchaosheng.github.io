---
title: RISC-V SMP 启动：多个 hart 如何加入 Linux
date: 2026-07-29 13:50:00
categories: [技术, RISC-V]
tags: [SMP, hart, Linux启动]
---

SMP 启动先由 boot hart 完成内存、页表和调度基础初始化，再通过 SBI HSM 或平台机制启动 secondary hart。次级 hart 建立自己的栈、页表与 per-CPU 状态后进入 idle。

<div class="note-flow"><span>Boot hart 初始化内核</span><i>→</i><span>解析 CPU 拓扑</span><i>→</i><span>SBI hart_start</span><i>→</i><span>Secondary 建立 per-CPU 环境</span><i>→</i><span>上线并进入调度</span></div>

排障重点包括设备树 CPU 节点、ISA 能力一致性、启动入口物理地址、IPI 与中断控制器。hart 启动成功不代表已可调度，必须完成 CPU online 状态转换。

参考：[RISC-V SMP Linux boot process](https://tinylab.org/smp-linux-boot/)
