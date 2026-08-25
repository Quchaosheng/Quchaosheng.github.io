---
title: 在 QEMU 里做 RISC-V 系统验证：配置声明与访问证据要分开
date: 2026-08-24 20:30:00
permalink: /2026/08/24/qemu-riscv-boundary-validation/
categories: [技术, 项目方法]
tags: [RISC-V, QEMU, OpenSBI, 系统验证]
---

在 RISC-V 多执行域实验中，仅仅写出一份资源配置并成功启动，不足以证明隔离成立。配置声明描述“希望怎样划分”，异常探针才回答“越界访问是否真的被拒绝”。

<div class="note-flow"><span>声明资源边界</span><i>→</i><span>完成多域启动</span><i>→</i><span>正向功能验证</span><i>→</i><span>双向越界探针</span><i>→</i><span>保存异常证据</span></div>

<div class="note-map"><span><b>声明</b><small>资源与执行域配置</small></span><span><b>探针</b><small>正向对照和负向访问</small></span><span><b>边界</b><small>区分 hart、DMA 与硬件</small></span></div>

## 启动与隔离是两个验收项

系统能进入各自运行环境，只说明启动链、内存映射和基本调度大体可用。隔离需要从两个方向主动访问对方受保护区域，并记录异常类型、地址和发起上下文。只测一个方向，可能漏掉配置不对称。

探针自身也要合法。如果页表映射、特权级或地址准备不正确，访问会在更早的阶段失败，测试到的就不是目标边界。每个负向探针都应配一个同路径的正向对照，证明测试工具本身可用。

## I/O 边界要单独看

处理器访问控制通常约束 hart，并不自动约束 DMA master。设备可访问内存还需要 IOMMU、总线防火墙或平台机制。把处理器探针通过写成“所有 I/O 都被隔离”，属于证据越界。

QEMU 很适合固定模型、快速回归和异常注入，但不能替代真实硬件的缓存一致性、时钟、中断、电气与性能验证。迁移真机时应重新检查内存布局、设备树、DMA 和中断控制器。

## 参考资料

- [RISC-V privileged architecture](https://github.com/riscv/riscv-isa-manual/releases)
- [OpenSBI domain support](https://github.com/riscv-software-src/opensbi/blob/master/docs/domain_support.md)

## 证据边界

本文只总结公开架构下的验证思路，不披露私有内存地址、配置文件、启动参数或未公开代码，也不把虚拟平台结论外推为硬件安全认证。
