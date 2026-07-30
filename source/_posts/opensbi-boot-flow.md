---
title: OpenSBI 启动流程：从 M 模式进入操作系统
date: 2026-05-14 20:00:00
permalink: /2026/07/29/opensbi-boot-flow/
categories: [技术, RISC-V]
tags: [OpenSBI, SBI, 启动]
---

OpenSBI 通常运行在 RISC-V M 模式，为 S 模式操作系统提供定时器、IPI、复位和 hart 管理等 SBI 服务，并完成进入内核前的最低层初始化。它把平台最底层的差异放在固件里，让 Linux、BSD 或自研 S 模式内核不必直接依赖每块板子的中断和电源实现。

<div class="note-flow"><span>固件入口与重定位</span><i>→</i><span>选出 coldboot hart</span><i>→</i><span>初始化平台与 SBI 子系统</span><i>→</i><span>唤醒其他 hart</span><i>→</i><span>切换到 S 模式内核入口</span></div>

<figure class="note-visual"><figcaption><span>启动图</span>coldboot hart 建立全局环境，warmboot hart 等待并复用已准备好的平台状态。</figcaption><div class="note-map"><span><b>固件入口</b><small>建立早期栈、重定位和最小 CPU 状态，不能依赖普通运行时。</small></span><span><b>coldboot hart</b><small>负责一次性的全局初始化，例如平台探测和控制台。</small></span><span><b>warmboot hart</b><small>等待共享状态就绪，避免多个 hart 同时初始化同一资源。</small></span><span><b>SBI 子系统</b><small>注册 TIME、IPI、HSM、复位等扩展的实现。</small></span><span><b>异常委托</b><small>通过 CSR 选择哪些异常和中断交给 S 模式处理。</small></span><span><b>进入内核</b><small>设置 `mepc`、权限和参数后以 `mret` 跳转到 S 模式入口。</small></span></div></figure>

## 冷启动和次级启动必须分工

一个 hart 被选为 coldboot hart 后，才可以初始化全局锁、设备树、控制台和 SBI 服务表。其余 hart 走 warmboot 路径，等待共享状态可见后再建立本地栈和 trap 环境。这里的同步不仅是逻辑正确性问题，也涉及缓存一致性和内存屏障；否则次级 hart 可能看到半初始化的平台数据。

## 切到 S 模式前要交接哪些信息

固件会配置 `mstatus`、`mepc`、`medeleg`、`mideleg` 等 CSR，使 S 模式内核能够接管自己负责的异常和中断。常见约定会把 hart ID 和设备树地址传给内核入口，但具体启动协议仍以目标系统要求为准。若内核早期卡住，优先核对入口地址、设备树、委托位、控制台和次级 hart 启动参数，而不是只看是否已经执行了 `mret`。

参考：[OpenSBI 固件代码分析：启动流程](https://tinylab.org/sbi-firmware-analyze-1/)
