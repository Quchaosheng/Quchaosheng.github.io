---
title: ksoftirqd：软中断为何会转入内核线程
date: 2026-07-29 14:09:00
categories: [技术, Linux内核]
tags: [软中断, ksoftirqd, 网络]
---

硬中断只做紧急工作并触发软中断。若软中断处理时间或次数超过预算，剩余工作交给每 CPU 的 `ksoftirqd` 线程，避免长期占据不可抢占的中断返回路径。

<div class="note-flow"><span>硬中断触发 softirq</span><i>→</i><span>中断返回路径处理</span><i>→</i><span>超过预算</span><i>→</i><span>唤醒 ksoftirqd/N</span><i>→</i><span>线程上下文继续处理</span></div>

ksoftirqd 持续高占用通常表示网络包量、队列分布或处理速度失衡，应结合 `/proc/softirqs`、网卡队列和丢包统计定位。

参考：[Linux 内核网络中的软中断 ksoftirqd](https://www.kerneltravel.net/blog/2020/ksoftirqd_ljr/)
