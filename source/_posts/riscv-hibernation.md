---
title: RISC-V 休眠与恢复：把运行现场写入交换区
date: 2026-07-03 14:10:00
permalink: /2026/07/29/riscv-hibernation/
categories: [技术, RISC-V]
tags: [休眠, 电源管理, swap]
---

休眠将内存快照写入持久存储后关机，下次启动时加载镜像并恢复 CPU 与设备状态。它不同于 suspend-to-RAM，后者仍依赖内存供电。

<div class="note-flow"><span>冻结任务与设备</span><i>→</i><span>创建内存快照</span><i>→</i><span>写入 swap 并关机</span><i>→</i><span>重新启动并识别镜像</span><i>→</i><span>恢复页面、CPU 与设备</span></div>

恢复内核先正常启动到安全阶段，再覆盖大部分内存并跳回保存的执行点。架构代码必须保存不可由普通内存镜像恢复的寄存器状态，并正确处理页表、缓存和多 hart。

参考：[RISC-V 休眠实现分析](https://tinylab.org/riscv-hibernation-impl-1/)
