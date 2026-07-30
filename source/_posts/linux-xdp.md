---
title: XDP：在网络栈最前面处理数据包
date: 2026-03-05 14:00:00
permalink: /2026/07/29/linux-xdp/
categories: [技术, Linux网络]
tags: [XDP, eBPF, 网络性能]
---

许多无效流量在进入完整网络栈之前就已经可以判断，例如明显不需要的包、简单 ACL、DDoS 特征或可直接转发的报文。XDP 让 eBPF 程序在驱动接收路径的早期访问包数据，并返回明确动作：丢弃、放行、从同一设备发回、重定向到另一设备/CPU/AF_XDP socket。越早做出决定，就越能省掉 skb 分配、协议解析和 socket 查找等后续成本。

<div class="note-flow"><span>网卡收到报文</span><i>→</i><span>XDP eBPF 程序</span><i>→</i><span>DROP/PASS/REDIRECT</span><i>→</i><span>必要时进入协议栈</span></div>

## XDP 的动作与运行位置

常见返回值包括 `XDP_DROP`（丢弃）、`XDP_PASS`（进入普通网络栈）、`XDP_TX`（从同一接口发回）和 `XDP_REDIRECT`（转发到其他设备、CPU 或用户态队列）。native/driver 模式在驱动最早路径运行，性能最好但要求驱动支持；generic 模式兼容性更好但路径更靠后；某些网卡还支持硬件 offload，能力和限制更严格。

<div class="note-map"><span><b>native XDP</b><small>在驱动早期执行；高性能；依赖网卡驱动能力</small></span><span><b>generic XDP</b><small>兼容路径更广；通常性能较低，适合开发/验证</small></span><span><b>hardware offload</b><small>在网卡执行；限制更多，需硬件和驱动明确支持</small></span><span><b>DROP</b><small>尽早丢无效包，节省后续协议栈与 CPU</small></span><span><b>PASS</b><small>交给常规栈，保持现有 socket/路由语义</small></span><span><b>REDIRECT/XSK</b><small>高效转发或交给用户态 fast path，需设计缓冲与背压</small></span></div>

## verifier 为什么是 XDP 的前提

eBPF 程序会由 verifier 验证：所有包访问必须有边界检查，控制流不能无限循环，指针类型与 helper 调用必须合法。它限制了你能写什么，也让内核可以在运行前拒绝明显不安全的程序。实际开发中，解析 Ethernet/IP/UDP 时每推进一次指针都要检查 `data_end`，不能把用户输入包当作可信结构。

```c
if (data + sizeof(struct ethhdr) > data_end)
    return XDP_DROP;
/* 再逐层检查 IP、UDP 头与长度，才读取字段 */
```

加载命令、section 名称与工具链会随 libbpf/iproute2 版本变化，但验证思路不变：先在测试接口上 attach，再用计数器/trace 验证每种 action，最后才考虑部署到承载真实流量的端口。

## 什么时候不该用 XDP

若业务需要完整 TCP 状态、复杂应用协议、加密解密或与现有 socket 语义深度耦合，XDP 未必是正确层次。把大量业务逻辑塞进 eBPF 会降低可维护性，也让排障变复杂。它最适合尽早做简单、明确、可验证的分类与转发决策，然后把需要复杂处理的包 `PASS` 给后续系统。

评估时同时看每秒处理包数、CPU、丢包、错误 action 和端到端业务延迟。XDP 的成功不是“跑得比协议栈快”，而是以更少资源完成了应该在最前面完成的工作。

参考：[XDP](https://docs.kernel.org/bpf/prog_xdp.html) · [eBPF verifier](https://docs.kernel.org/bpf/verifier.html)
