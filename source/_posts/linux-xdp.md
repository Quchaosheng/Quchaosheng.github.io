---
title: XDP：在网络栈最前面处理数据包
date: 2026-07-29 13:42:00
categories: [技术, Linux网络]
tags: [XDP, eBPF, 网络性能]
---

XDP 允许 eBPF 程序在驱动接收路径的早期处理报文，可选择丢弃、放行、重定向或交给 socket，从而避免无效流量进入完整协议栈。

<div class="note-flow"><span>网卡收到报文</span><i>→</i><span>XDP eBPF 程序</span><i>→</i><span>DROP/PASS/REDIRECT</span><i>→</i><span>必要时进入协议栈</span></div>

XDP 适合 DDoS 过滤、负载均衡和高速转发。其能力受驱动模式影响：native XDP 性能最佳，generic XDP 兼容性更好但路径更靠后。程序必须通过 verifier 校验。

参考：[XDP 与 Linux 内核网络栈](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247485563&idx=1&sn=37489204d5d0b016566914c4a7f736b8)
