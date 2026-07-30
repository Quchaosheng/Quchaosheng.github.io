---
title: NAPI：Linux 如何承受高并发收包
date: 2026-07-29 13:11:00
categories: [技术, Linux网络]
tags: [NAPI, 网卡驱动, 网络性能]
---

纯中断收包在高流量下会产生中断风暴，纯轮询在低流量下又浪费 CPU。NAPI 采用“中断唤醒、预算轮询”的混合模型，在吞吐和延迟之间取得平衡。

## 收包流程

首个包触发中断，驱动关闭该接收队列的中断并调度 NAPI。软中断上下文调用 poll，在预算内批量清理描述符；队列清空后完成本轮 NAPI 并重新开启中断。

<div class="note-flow"><span>网卡产生接收中断</span><i>→</i><span>关闭队列中断</span><i>→</i><span>调度 NAPI poll</span><i>→</i><span>按 budget 批量收包</span><i>→</i><span>清空后重开中断</span></div>

## 记忆要点

- budget 防止单个网卡长期霸占软中断。
- GRO 可合并同一流的小包，降低协议栈逐包开销。
- RSS/RPS/RFS 用于把流量分散到多个队列或 CPU。

参考：[从 0 到 1，带你吃透 Linux NAPI 高并发收包](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494961&idx=1&sn=c23a191cbf74be52161d852543f7cbde)
