---
title: SMI 与固件延迟：Linux 追踪不到的实时尖峰从哪里来
date: 2026-07-30 09:24:00
categories: [技术, Linux实时]
tags: [SMI, NMI, 固件, 延迟]
---

有一种实时尖峰特别让人困惑：`cyclictest` 明确记录到几百微秒甚至毫秒级延迟，ftrace 时间线上却没有足够长的 IRQ、锁或调度事件。对于 x86 平台，系统管理中断（SMI）会让 CPU 进入 System Management Mode 执行固件代码；普通操作系统不能抢占它，也通常看不到里面的调用栈。热管理、BIOS 服务、硬件纠错与平台管理都可能在这里引入不可见时间。

<div class="note-flow"><span>实时测试捕获尖峰</span><i>→</i><span>内核事件无法解释</span><i>→</i><span>核对 NMI/SMI 与硬件计数</span><i>→</i><span>调整 BIOS/固件策略</span><i>→</i><span>同负载长时间复测</span></div>

## 为什么 Linux 看不见这段时间

普通 IRQ 和调度事件都由内核管理，因此能被 trace 记录；SMI 则在处理器切换到 SMM 后由固件执行，内核甚至不知道它内部做了什么。NMI 也具有高优先级和特殊上下文，但与 SMI 不同，它仍属于 CPU/内核可观察的机制。两者都可能表现为“系统短暂无响应”，排查路径却不同。

<div class="note-map"><span><b>普通 IRQ</b><small>内核可追踪，通常可通过亲和性和线程化治理</small></span><span><b>NMI</b><small>优先级很高，内核可部分观察但不能像普通线程调度</small></span><span><b>SMI/SMM</b><small>固件接管 CPU，OS 通常无法看到内部调用链</small></span><span><b>hwlat detector</b><small>通过高优先级采样寻找疑似硬件/固件延迟窗口</small></span><span><b>BIOS/firmware</b><small>电源、风扇、USB legacy、纠错等策略可能是根因</small></span><span><b>正确动作</b><small>逐项验证、保留安全功能、长时间同负载复测</small></span></div>

## 怎么确认“像是固件问题”

先把已知的内核原因排除：检查 IRQ/softirq、线程迁移、缺页、RT 节流、频率变化和设备驱动。如果尖峰期间 trace 几乎空白，且在温度变化、长时间运行或特定 I/O 事件后重复出现，才将固件/硬件列为强嫌疑。内核的 hwlat detector 可帮助检测这类不可解释的硬件延迟，但它提供的是线索，不会告诉你具体 BIOS 函数。

```bash
# 先确认内核是否提供相关 tracer；路径随挂载点和内核配置而不同
grep -R "hwlat" /sys/kernel/tracing/available_tracers /sys/kernel/debug/tracing/available_tracers 2>/dev/null
```

测试这类问题需要比一般 benchmark 更长的时间：某些热管理或巡检任务可能几十分钟才触发一次。记录温度、风扇、供电、BIOS 版本和发生时刻，往往比多跑一次短测更有价值。

## 处理原则：改变一个变量，别破坏平台安全

优先更新 BIOS、BMC/EC 和设备 firmware，阅读厂商发布说明；再逐项实验电源策略、USB legacy、内存巡检、风扇控制等选项。不要为了消掉一个尖峰就盲目关闭 ECC、热保护、看门狗或安全管理功能。每项变更都必须在相同负载和温度条件下复测，并保留能回滚的配置记录。

实时性是整机属性。Linux 内核能帮你缩短可控的延迟，但当尖峰来自固件时，真正的修复可能在 BIOS、板级设计、散热或硬件选型上。

参考：[hwlat detector](https://docs.kernel.org/trace/hwlat_detector.html) · [ftrace](https://docs.kernel.org/trace/ftrace.html)
