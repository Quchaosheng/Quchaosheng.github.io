---
title: eBPF 程序生命周期：加载、验证、挂载与通信
date: 2026-05-22 20:00:00
permalink: /2026/07/29/ebpf-program-lifecycle/
categories: [技术, Linux内核]
tags: [eBPF, Verifier, BPF Map]
---

eBPF 让受限程序在内核事件点执行。用户态加载字节码，Verifier 验证控制流、边界与指针安全，通过后由解释器或 JIT 执行，并通过 Map 与用户态交换状态。

<div class="note-flow"><span>编译 eBPF 对象</span><i>→</i><span>bpf 系统调用加载</span><i>→</i><span>Verifier 静态验证</span><i>→</i><span>JIT 并挂载到 Hook</span><i>→</i><span>事件触发并通过 Map/RingBuf 输出</span></div>

程序类型决定可用上下文、Helper 与挂载位置。Map 的并发语义、对象 pinning、版本兼容和采样开销都是工程设计的一部分；Verifier 通过只代表“可证明安全”，不代表业务逻辑正确。

参考：[eBPF 程序构成与通信](https://tinylab.org/ebpf-part1/)
