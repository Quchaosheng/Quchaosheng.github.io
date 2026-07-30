---
title: RISC-V SBI：固件与操作系统之间的统一接口
date: 2026-07-02 14:10:00
permalink: /2026/07/29/riscv-sbi/
categories: [技术, RISC-V]
tags: [SBI, OpenSBI, 特权级]
---

SBI 类似操作系统与机器态固件之间的 ABI。S 模式内核通过 `ecall` 请求 M 模式执行其无权直接完成的操作，避免每个内核绑定具体平台实现。

<div class="note-flow"><span>内核准备扩展 ID 与参数</span><i>→</i><span>执行 ecall</span><i>→</i><span>M 模式固件分发请求</span><i>→</i><span>操作硬件</span><i>→</i><span>返回错误码与结果</span></div>

常见扩展包括 BASE、TIME、IPI、RFENCE、HSM、SRST。SBI 不是设备驱动框架；它只抽象必须由更高特权级完成的基础服务。

参考：[RISC-V SBI 概述](https://tinylab.org/introduction-to-riscv-sbi/)
