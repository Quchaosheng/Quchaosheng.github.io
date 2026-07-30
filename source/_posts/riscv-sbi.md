---
title: RISC-V SBI：固件与操作系统之间的统一接口
date: 2026-05-15 14:00:00
permalink: /2026/07/29/riscv-sbi/
categories: [技术, RISC-V]
tags: [SBI, OpenSBI, 特权级]
---

SBI 类似操作系统与机器态固件之间的 ABI。S 模式内核通过 `ecall` 请求 M 模式执行自己无权直接完成的操作，避免每个内核绑定具体平台实现。它抽象的是定时器、IPI、hart 生命周期、复位等特权服务，不是替代所有设备驱动的通用框架。

<div class="note-flow"><span>内核准备扩展 ID 与参数</span><i>→</i><span>执行 ecall</span><i>→</i><span>M 模式固件分发请求</span><i>→</i><span>操作硬件</span><i>→</i><span>返回错误码与结果</span></div>

<figure class="note-visual"><figcaption><span>调用图</span>SBI 扩展和函数 ID 描述请求，固件负责把请求落到具体平台操作。</figcaption><div class="note-map"><span><b>S 模式内核</b><small>准备扩展 ID、函数 ID 和参数，再执行 `ecall`。</small></span><span><b>扩展探测</b><small>BASE 等接口可确认目标固件是否支持某类服务。</small></span><span><b>TIME</b><small>设置下一次 timer 事件，供内核调度和定时器使用。</small></span><span><b>IPI / RFENCE</b><small>向其他 hart 发送中断或请求 TLB、指令缓存相关同步。</small></span><span><b>HSM</b><small>启动、停止或查询 hart 状态，支撑 SMP 生命周期。</small></span><span><b>错误码</b><small>调用方必须检查返回值，不能把“不支持”当作成功。</small></span></div></figure>

## SBI 让内核依赖接口，而不是特定寄存器

同样是设置定时器，不同芯片的 M 模式实现可能完全不同；S 模式内核只需要调用约定的 TIME 服务。这样平台固件可以改变底层中断控制器、电源管理或 hart 启动细节，内核仍使用相同 ABI。对应的代价是内核必须先探测扩展，并对旧固件或缺失能力保留降级路径。

## 调试时看参数、返回值和权限边界

`ecall` 失败时，不要只看“陷入了固件”。确认扩展和函数 ID、参数寄存器、目标 hart mask、固件版本和返回错误码。若请求本应由 S 模式直接处理，绕到 SBI 反而说明权限划分或驱动模型可能设计错了。SBI 调用也有成本，高频路径要避免无意义地跨特权级往返。

参考：[RISC-V SBI 概述](https://tinylab.org/introduction-to-riscv-sbi/)
