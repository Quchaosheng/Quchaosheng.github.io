---
title: RISC-V 中断：从外设信号到处理函数
date: 2026-04-20 10:00:00
source_checked_at: 2026-07-29 16:09:18
permalink: /2026/07/29/riscv-interrupt/
categories: [技术, 嵌入式Linux]
tags: [RISC-V, 中断, PLIC]
description: 区分 RISC-V trap、本地中断、PLIC 与 Linux IRQ 层，给出从外设信号到驱动处理函数的排查方法。
---

RISC-V 把同步异常和异步中断统一纳入 trap 机制。指令访问异常、系统调用属于同步异常；软件、定时器和外部中断则由相应 pending/enable 条件触发。平台级外设常通过 PLIC 汇聚，但采用 AIA/IMSIC 的新平台路径不同，因此“RISC-V 中断就是 PLIC”并不准确。

## 特权级与入口寄存器

每个特权级有对应 trap vector、cause、epc 和 status 寄存器，例如 S 模式使用 `stvec`、`scause`、`sepc` 和 `sstatus`。trap 到达哪个特权级取决于委托配置和中断路由。运行 Linux 的系统通常还涉及 M 模式固件（如 OpenSBI）与 S 模式内核的分工，不能只看驱动源码推断完整链路。

<div class="note-flow"><span>外设产生中断</span><i>→</i><span>PLIC 仲裁与投递</span><i>→</i><span>CPU 进入 trap</span><i>→</i><span>claim 并处理 IRQ</span><i>→</i><span>complete 后返回</span></div>

<div class="note-map"><span><b>本地软件中断</b><small>常用于 hart 间通知</small></span><span><b>本地定时器中断</b><small>由平台定时机制提供周期或 deadline</small></span><span><b>外部中断</b><small>PLIC 或 AIA 等控制器负责路由</small></span><span><b>trap 入口</b><small>保存上下文并解析 cause</small></span><span><b>irqchip</b><small>把控制器操作接入 Linux IRQ domain</small></span><span><b>设备 ISR</b><small>确认设备状态并处理中断来源</small></span></div>

## PLIC 路径里发生什么

在典型 PLIC 平台上，每个中断源有 pending 状态和优先级，每个 target context 有 enable 位图与 threshold。外设拉起中断后，PLIC 选择优先级高于阈值且已使能的来源；hart 收到外部中断并进入 trap，软件读取 claim 寄存器获得中断号。处理完成后，将该编号写回 complete。若设备侧中断条件没有清除，完成后仍可能再次触发。

claim/complete 只处理控制器侧仲裁。驱动 ISR 仍要读取设备状态寄存器，区分多个可能来源，并按设备要求清除或屏蔽中断。电平触发设备尤其要避免“只 complete、不清设备”的中断风暴。

## Linux 中的映射层

设备树描述 interrupt parent、specifier 与触发类型，irqchip 驱动建立 IRQ domain，把硬件中断号映射为 Linux IRQ。设备驱动通过 `request_irq()` 或 `devm_request_threaded_irq()` 注册处理函数。硬中断部分应只完成必须立即处理的工作，可能睡眠或较慢的操作放在线程化 handler、workqueue 或其他合适上下文。

```bash
cat /proc/interrupts
grep -R . /proc/irq/IRQ_NUMBER/{smp_affinity_list,effective_affinity_list} 2>/dev/null
dmesg -T | grep -i -E 'plic|imsic|irqchip|interrupt'

# 设备树可用时查看 interrupt 相关属性
find /sys/firmware/devicetree/base -name interrupt\* -print | head
```

`/proc/interrupts` 计数增长说明 Linux 处理了对应 IRQ，但不能证明每次设备事件都被正确消费。还要同时检查设备寄存器、丢事件统计、CPU 亲和性和 handler 执行时间。QEMU virt 上的结果也不能直接代表具体 SoC 的中断拓扑。

## 常见故障顺序

1. 确认设备侧是否真的产生中断，极性和触发类型是否一致。
2. 检查设备树 interrupt specifier、父控制器和 irqchip 是否完成初始化。
3. 检查 `/proc/interrupts` 是否出现并增长，handler 是否返回正确状态。
4. 若出现风暴，确认设备状态清除顺序、屏蔽逻辑和电平信号是否仍保持有效。
5. 多核系统再检查 affinity、负载与线程化 handler 的调度条件。

## 证据边界

本文以传统 PLIC 路径解释主要概念，没有覆盖 AIA、虚拟化中断注入和所有厂商扩展。具体寄存器与路由必须以目标平台设备树、特权规范和 irqchip 驱动为准。

参考：[RISC-V Privileged Architecture](https://docs.riscv.org/reference/isa/priv/priv-index.html) · [RISC-V PLIC specification](https://github.com/riscv/riscv-plic-spec/blob/master/riscv-plic.adoc) · [Linux generic IRQ handling](https://docs.kernel.org/core-api/genericirq.html) · [不懂 RISC-V 中断，难以吃透嵌入式底层编程](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247495022&idx=1&sn=62b0575d76e08ab5db211758e80d7ef9)
