---
title: RISC-V SMP 启动：多个 hart 如何加入 Linux
date: 2026-05-16 14:00:00
permalink: /2026/07/29/riscv-smp-boot/
categories: [技术, RISC-V]
tags: [SMP, hart, Linux启动]
---

SMP 启动先由 boot hart 完成内存、页表和调度基础初始化，再通过 SBI HSM 或平台机制启动 secondary hart。次级 hart 需要建立自己的栈、页表相关状态、trap 向量和 per-CPU 数据，随后进入 idle，等待调度器把工作分给它。hart 已经开始取指，不等于该 CPU 已经安全上线。

<div class="note-flow"><span>Boot hart 初始化内核</span><i>→</i><span>解析 CPU 拓扑</span><i>→</i><span>SBI hart_start</span><i>→</i><span>Secondary 建立 per-CPU 环境</span><i>→</i><span>上线并进入调度</span></div>

<figure class="note-visual"><figcaption><span>多核图</span>启动 CPU 建全局资源，次级 CPU 建本地资源，二者在上线点同步。</figcaption><div class="note-map"><span><b>设备树 CPU 节点</b><small>描述可用 hart、拓扑和可能的启用状态。</small></span><span><b>boot hart</b><small>建立全局内存、调度器、IPI 和中断基础设施。</small></span><span><b>hart_start</b><small>通过 SBI 或平台接口请求次级 hart 从指定物理入口开始执行。</small></span><span><b>本地栈</b><small>每个 CPU 需要独立的早期栈和 per-CPU 区域。</small></span><span><b>trap/中断</b><small>次级 CPU 必须能处理本地异常、IPI 和定时器后才可工作。</small></span><span><b>CPU online</b><small>完成同步后加入调度域，才会真正承接任务。</small></span></div></figure>

## 全局初始化和本地初始化不能抢跑

启动 CPU 先初始化其他 hart 将共享的页表、内存分配器、IPI 控制和调度数据，再发布“可以启动”的状态。次级 hart 看到状态后才使用这些资源，并在本地初始化完成后回报 ready。这里需要正确的内存屏障和状态机；日志打印出“secondary started”只能说明走到了某一步，不能证明已经看到完整共享数据。

## 常见故障集中在地址与中断链路

排障时核对设备树 CPU 节点、ISA 扩展一致性、`hart_start` 入口物理地址、次级栈、IPI 和定时器中断。若 hart 启动后立刻挂住，优先检查 trap 向量和页表映射；若 CPU 显示 online 却没有工作，继续检查调度域和中断亲和性。每个阶段都留下可区分的标记，比只在启动函数开头打印一行更有用。

参考：[RISC-V SMP Linux boot process](https://tinylab.org/smp-linux-boot/)
