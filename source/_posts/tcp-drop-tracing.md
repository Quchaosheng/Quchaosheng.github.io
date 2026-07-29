---
title: TCP 丢包追踪：用 kprobe 与 tracepoint 串起证据链
date: 2026-07-29 14:14:00
categories: [技术, Linux网络]
tags: [丢包, kprobe, tracepoint]
---

丢包可能发生在网卡 ring、驱动、softnet backlog、协议栈、socket 队列或应用层。应先用计数器确定层级，再用 tracepoint/kprobe 捕获具体函数、skb 与调用栈。

<div class="note-flow"><span>确认吞吐下降或重传</span><i>→</i><span>对比网卡/softnet/socket 计数</span><i>→</i><span>锁定丢包层</span><i>→</i><span>挂载 tracepoint/kprobe</span><i>→</i><span>关联五元组与调用栈</span></div>

tracepoint 接口更稳定，kprobe 灵活但受内核版本和内联影响。采样要限制过滤条件，防止追踪高流量路径本身造成压力。

参考：[TCP 丢包分析：kprobe 和 tracepoint](https://www.kerneltravel.net/blog/2020/tcp_kprobe/)
