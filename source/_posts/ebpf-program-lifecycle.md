---
title: eBPF 程序生命周期：加载、验证、挂载与通信
date: 2026-05-22 20:00:00
permalink: /2026/07/29/ebpf-program-lifecycle/
categories: [技术, Linux内核]
tags: [eBPF, Verifier, BPF Map]
---

eBPF 让受限程序在内核事件点执行。用户态加载字节码，Verifier 逐条验证控制流、边界和指针安全；通过后内核可以解释执行或 JIT 编译，并通过 Map、perf buffer 或 ring buffer 与用户态交换数据。它适合观测和受限处理，但不是把任意 C 代码搬进内核。

<div class="note-flow"><span>编译 eBPF 对象</span><i>→</i><span>bpf 系统调用加载</span><i>→</i><span>Verifier 静态验证</span><i>→</i><span>JIT 并挂载到 Hook</span><i>→</i><span>事件触发并通过 Map/RingBuf 输出</span></div>

<figure class="note-visual"><figcaption><span>对象图</span>程序类型决定上下文，Map 决定数据怎样跨越用户态和内核态。</figcaption><div class="note-map"><span><b>ELF 对象</b><small>包含程序段、Map 定义、BTF 和重定位信息。</small></span><span><b>program type</b><small>决定可访问的上下文、Helper 和可挂载位置。</small></span><span><b>Verifier</b><small>证明每条路径安全结束，限制循环、边界和指针使用。</small></span><span><b>JIT</b><small>把通过验证的指令编译为本机代码，降低运行开销。</small></span><span><b>Map</b><small>保存计数、配置或状态，必须明确并发和生命周期语义。</small></span><span><b>事件输出</b><small>高频事件应批量或采样，避免观测本身成为负载。</small></span></div></figure>

## 先选 Hook 和数据模型，再写程序

要观察函数调用、网络包、调度事件还是用户态探针，会决定使用 tracepoint、kprobe、fentry/fexit、XDP 或 uprobe 等不同入口。入口一旦确定，再列出真正需要的字段和采样频率。把所有数据都塞进 Map、每个事件都打印，通常会先把性能和可读性拖垮。

Map 也不是普通全局变量。哈希、数组、per-CPU、ring buffer 等类型各有内存、锁和用户态读取语义。对长期运行的工具，要考虑对象 pinning、进程退出后的清理和内核版本差异；对诊断工具，要给丢失事件和 map 满容量留出可观测指标。

## Verifier 通过不代表诊断结论正确

Verifier 只证明程序在它能分析的条件下不会进行不安全访问。它不保证你选的 Hook 正好覆盖了问题，也不保证时间戳、进程身份和采样率足以支持业务归因。发布前应在已知工作负载下核对事件数量、延迟和输出的关联关系，再把它用在真正的故障场景。

参考：[eBPF 程序构成与通信](https://tinylab.org/ebpf-part1/)
