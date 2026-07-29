---
title: RISC-V KVM：Host、Guest 与两阶段地址翻译
date: 2026-07-29 13:55:00
categories: [技术, 虚拟化]
tags: [KVM, RISC-V, 虚拟内存]
---

KVM 让 Linux 内核提供虚拟 CPU、内存映射和中断注入，用户态 VMM 负责设备模型与虚拟机生命周期。RISC-V H 扩展提供 VS/VU 模式和两阶段地址翻译。

<div class="note-flow"><span>用户态 VMM 创建 VM/vCPU</span><i>→</i><span>KVM_RUN 进入 Guest</span><i>→</i><span>Guest 执行或产生 trap</span><i>→</i><span>KVM 处理或退出用户态</span><i>→</i><span>注入结果并继续</span></div>

Guest 虚拟地址先经 VS-stage 转为 Guest 物理地址，再经 G-stage 映射到 Host 物理地址。设备访问、缺失映射与特权操作会产生 VM exit，性能优化目标是减少不必要退出。

参考：[RISC-V KVM 内存虚拟化](https://tinylab.org/riscv-kvm-mem-virt-impl/)
