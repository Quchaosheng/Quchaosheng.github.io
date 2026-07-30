---
title: RISC-V KVM：Host、Guest 与两阶段地址翻译
date: 2026-05-21 14:00:00
permalink: /2026/07/29/riscv-kvm-virtualization/
categories: [技术, 虚拟化]
tags: [KVM, RISC-V, 虚拟内存]
---

KVM 让 Linux 内核提供虚拟 CPU、内存映射和中断注入，用户态 VMM 负责设备模型与虚拟机生命周期。RISC-V H 扩展提供 VS/VU 模式和两阶段地址翻译。性能的关键不是“虚拟机里有没有执行指令”，而是它在 Guest、内核和用户态设备模型之间来回切换了多少次。

<div class="note-flow"><span>用户态 VMM 创建 VM/vCPU</span><i>→</i><span>KVM_RUN 进入 Guest</span><i>→</i><span>Guest 执行或产生 trap</span><i>→</i><span>KVM 处理或退出用户态</span><i>→</i><span>注入结果并继续</span></div>

<figure class="note-visual"><figcaption><span>虚拟化图</span>地址翻译和设备访问决定 Guest 能否长时间留在硬件执行。</figcaption><div class="note-map"><span><b>用户态 VMM</b><small>创建 VM/vCPU、管理内存并模拟或转发设备。</small></span><span><b>KVM 内核</b><small>配置硬件虚拟化状态，处理可在内核完成的 trap。</small></span><span><b>Guest 虚拟地址</b><small>Guest OS 自己的页表先翻译为 Guest 物理地址。</small></span><span><b>G-stage</b><small>将 Guest 物理地址映射到 Host 物理地址，提供隔离。</small></span><span><b>VM exit</b><small>设备访问、异常或缺失映射可能退出到 Host 处理。</small></span><span><b>中断注入</b><small>Host 在合适时机把虚拟中断交回 Guest。</small></span></div></figure>

## 两阶段地址翻译分别解决什么

Guest 的 VS-stage 页表把应用虚拟地址翻译为 Guest 物理地址；H 扩展的 G-stage 再把它翻译为 Host 物理地址。第一阶段由 Guest 管理，第二阶段由 Host 控制，因此 Host 可以限制 Guest 能访问的内存范围。两层任一处缺失映射都可能产生 trap，排查内存问题时要先确定卡在哪一层。

## 减少退出比微调单条指令更重要

每次设备模拟、特权操作或页表相关 trap 都可能让 Guest 退出到 Host。频繁 VM exit 会放大用户态 VMM 调度和锁竞争成本。性能优化通常先检查是否有高频 MMIO、无效中断、过多定时器或不合理的设备模型，再考虑更底层的指令级优化。虚拟化隔离也不是自动安全保证，VMM、内核和设备后端仍属于攻击面。

参考：[RISC-V KVM 内存虚拟化](https://tinylab.org/riscv-kvm-mem-virt-impl/)
