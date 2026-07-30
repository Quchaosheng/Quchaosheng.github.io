---
title: TCP 丢包追踪：用 kprobe 与 tracepoint 串起证据链
date: 2026-06-07 14:00:00
permalink: /2026/07/29/tcp-drop-tracing/
categories: [技术, Linux网络]
tags: [丢包, kprobe, tracepoint]
---

“TCP 重传变多”只说明发送方没有按预期收到确认，不说明包究竟在哪一层丢了。包可能在网卡 RX/TX ring、驱动、softnet backlog、协议栈校验、socket 队列、应用处理或链路对端消失。有效排障的顺序是先用计数器缩小层级，再用 tracepoint 或 kprobe 捕获少量、可关联的证据，最后将五元组、时间、CPU 和调用路径串起来。

<div class="note-flow"><span>确认吞吐下降或重传</span><i>→</i><span>对比网卡/softnet/socket 计数</span><i>→</i><span>锁定丢包层</span><i>→</i><span>挂载 tracepoint/kprobe</span><i>→</i><span>关联五元组与调用栈</span></div>

## 先按层收集“不会改变时序”的证据

网卡驱动统计可提示 RX/TX ring 是否溢出；`/proc/net/softnet_stat` 可提示协议栈接收处理是否来不及；`ss -ti`、`netstat -s` 或 `nstat` 可展示 TCP 重传、listen overflow、socket 错误等。先做两次快照并比较增量，才知道哪一个计数正在增长。

<div class="note-map"><span><b>设备/RX-TX ring</b><small>网卡已丢或无法及时 DMA/回收，先看 ethtool 驱动统计</small></span><span><b>softnet backlog</b><small>CPU/NAPI/softirq 处理不过来，包在协议栈入口被丢弃</small></span><span><b>协议栈</b><small>校验、路由、内存、队列或状态机导致的丢弃</small></span><span><b>socket 队列</b><small>应用消费慢、缓冲不足或连接状态导致的丢弃</small></span><span><b>链路/对端</b><small>交换机、MTU、拥塞或对端应用不可用，可能表现为重传</small></span><span><b>应用语义</b><small>发送成功不等于对端业务已处理，需独立确认与时间戳</small></span></div>

```bash
ethtool -S eth0
cat /proc/net/softnet_stat
ss -ti
nstat -az | grep -i -E 'retrans|drop|overflow'
```

不同驱动和内核暴露的字段不同，分析前应保存原始输出与时间。把所有计数拼成一个“大总数”通常会失去定位价值。

## tracepoint 优先，kprobe 用于补洞

tracepoint 是内核显式提供的观测事件，语义相对稳定，例如 TCP 重传、skb 释放、调度和 IRQ 事件；它更适合长期脚本。kprobe 可以挂到任意可探测函数，灵活但会受函数内联、重命名和内核版本影响，适合 tracepoint 不够时的短期定位。

```text
计数器发现 softnet 丢弃增长
  -> trace NAPI/softirq/IRQ 与 skb drop 相关事件
  -> 过滤指定接口、端口或 cgroup
  -> 关联发生 CPU、时间和包五元组
  -> 再决定是否需要对某个函数使用 kprobe
```

高流量路径上的跟踪本身会产生压力。必须限制 CPU、PID、端口、采样窗口或采样率，先在可复现小流量场景验证，再进入生产问题窗口。

## 最终证据应能回答什么

一条好的丢包报告不是“抓到一个 kprobe”，而是能够说明：哪个层的哪个计数增长、增长发生在何时/哪个 CPU、关联的流是什么、为什么该层会丢，以及修复后同一负载下计数和业务结果怎样变化。这样 TCP 重传从一个模糊症状，变成可验证的因果链。

参考：[Trace events](https://docs.kernel.org/trace/events.html) · [kprobes](https://docs.kernel.org/trace/kprobes.html) · [Linux networking statistics](https://docs.kernel.org/networking/statistics.html)
