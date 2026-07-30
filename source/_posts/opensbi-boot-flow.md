---
title: OpenSBI 启动流程：从 M 模式进入操作系统
date: 2026-07-02 09:30:00
permalink: /2026/07/29/opensbi-boot-flow/
categories: [技术, RISC-V]
tags: [OpenSBI, SBI, 启动]
---

OpenSBI 通常运行在 RISC-V M 模式，为 S 模式操作系统提供定时器、IPI、复位和 hart 管理等 SBI 服务，并完成进入内核前的最低层初始化。

<div class="note-flow"><span>固件入口与重定位</span><i>→</i><span>选出 coldboot hart</span><i>→</i><span>初始化平台与 SBI 子系统</span><i>→</i><span>唤醒其他 hart</span><i>→</i><span>切换到 S 模式内核入口</span></div>

coldboot hart 执行全局初始化，其他 hart 走 warmboot 并等待。OpenSBI 通过 `mstatus`、`mepc`、`medeleg/mideleg` 等 CSR 配置特权切换与异常委托，再以约定寄存器传递 hart ID 和设备树地址。

参考：[OpenSBI 固件代码分析：启动流程](https://tinylab.org/sbi-firmware-analyze-1/)
