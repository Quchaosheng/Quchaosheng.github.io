---
title: RISC-V 休眠与恢复：把运行现场写入交换区
date: 2026-05-18 14:00:00
permalink: /2026/07/29/riscv-hibernation/
categories: [技术, RISC-V]
tags: [休眠, 电源管理, swap]
---

休眠会把内存快照写入持久存储后关机，下次启动时加载镜像并恢复 CPU 与设备状态。它不同于 suspend-to-RAM，后者仍依赖内存供电。休眠的难点不是“把 RAM 写出去”，而是让任务、文件系统、设备 DMA 和架构状态在两个完全不同的启动阶段前后一致。

<div class="note-flow"><span>冻结任务与设备</span><i>→</i><span>创建内存快照</span><i>→</i><span>写入 swap 并关机</span><i>→</i><span>重新启动并识别镜像</span><i>→</i><span>恢复页面、CPU 与设备</span></div>

<figure class="note-visual"><figcaption><span>恢复图</span>恢复不是从断点直接继续，而是先启动一个最小内核，再接回保存的内存现场。</figcaption><div class="note-map"><span><b>冻结任务</b><small>阻止普通线程继续改变内存和文件系统状态。</small></span><span><b>冻结设备</b><small>停止 DMA 和新 I/O，避免快照期间仍有数据写入内存。</small></span><span><b>内存镜像</b><small>保存可恢复页面及必要元数据，通常写入 swap 或专用区域。</small></span><span><b>启动内核</b><small>下次开机先建立能读取镜像的最小安全环境。</small></span><span><b>架构状态</b><small>页表、缓存、CSR 和多 hart 状态不能只依赖普通 RAM 内容。</small></span><span><b>设备恢复</b><small>按驱动顺序重新初始化，并让设备重新获得一致状态。</small></span></div></figure>

## 休眠前要把“还在动”的东西停下来

任务冻结、防止新的文件系统写入和暂停设备 DMA 都是创建一致镜像的前提。一个网卡或存储控制器若在快照过程中继续写内存，恢复后看到的状态可能无法解释。驱动的 suspend/resume 回调因此不是形式上的钩子，而是定义设备在镜像两端如何停下和重建。

## RISC-V 架构状态需要单独处理

恢复内核先正常启动到能读取镜像的阶段，再覆盖大部分内存并跳回保存的执行点。页表、缓存、特权 CSR、中断控制器以及多 hart 的启动顺序必须在这个过程中保持正确。保存了内存不代表所有寄存器都能自动回来，架构代码需要明确哪些状态重新初始化、哪些状态从镜像恢复。

休眠最终还取决于存储可靠性、镜像空间和 `resume` 配置。测试时要覆盖断电、设备重新插拔和镜像校验失败等路径，而不是只验证一次正常休眠和恢复。

参考：[RISC-V 休眠实现分析](https://tinylab.org/riscv-hibernation-impl-1/)
