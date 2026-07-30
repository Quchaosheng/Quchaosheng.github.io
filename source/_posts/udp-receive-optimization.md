---
title: UDP 收包瓶颈：从网卡队列到应用线程
date: 2026-04-15 14:00:00
permalink: /2026/07/29/udp-receive-optimization/
categories: [技术, Linux网络]
tags: [UDP, 网络性能, 调优]
---

UDP 没有 TCP 的重传、拥塞控制和按序字节流语义，因此延迟低、协议简单，也意味着一旦某一层来不及处理，包会直接消失。丢包可能发生在网卡 RX ring、NAPI/softirq、协议栈内存、socket 接收队列，或应用来不及 `recvmsg()` 的阶段。把所有问题都归因于“接收 buffer 太小”通常会掩盖真正瓶颈。

<div class="note-flow"><span>RX ring</span><i>→</i><span>NAPI/软中断</span><i>→</i><span>IP/UDP 处理</span><i>→</i><span>Socket 接收队列</span><i>→</i><span>应用批量读取</span></div>

## 先区分四种丢包位置

网卡 ring 溢出表示驱动来不及回收描述符；softnet 压力表示 CPU/NAPI/协议栈处理不过来；socket 队列溢出表示包已经抵达 socket 却没有被应用及时取走；应用自身丢弃则可能是业务队列满、时间戳过期或校验失败。它们的症状都可能表现为“对端说我没收到”，修复方向却完全不同。

<div class="note-map"><span><b>RX ring</b><small>硬件接收缓冲；突发过大或 IRQ/NAPI 太慢会在最前面丢</small></span><span><b>softnet/NAPI</b><small>协议栈入口处理不过来，通常伴随 CPU/softirq 压力</small></span><span><b>UDP socket queue</b><small>内核已收包但应用消费慢或 SO_RCVBUF 不够</small></span><span><b>应用工作队列</b><small>解析/计算太慢，可能把新包挤成过期包</small></span><span><b>协议设计</b><small>是否有序号、时间戳、丢包统计和可接受数据年龄</small></span><span><b>调优原则</b><small>先定位层级，再改 ring、CPU、buffer 或消费策略</small></span></div>

## 观察命令与应用计数要配套

```bash
ethtool -S eth0
cat /proc/net/softnet_stat
netstat -su
ss -u -i
```

这些系统计数必须和应用自己的“收到包数、序号缺口、超期丢弃、解析失败、队列长度”一起看。若 kernel 统计没有丢包而应用序号有缺口，问题可能在对端/链路或业务协议；若 socket queue 相关丢弃增长，优先检查应用消费与缓冲；若 ring 错误增长，则看网卡队列、IRQ 和 NAPI。

## 应用侧不要一包一醒一包一处理

高频 UDP 服务可通过非阻塞 socket + epoll 批量就绪，再用 `recvmmsg()` 一次取多个报文，减少系统调用和唤醒开销。解析、日志和慢算法应从收包线程剥离到有界队列；收包线程只做时间戳、序号、最小校验和入队。

```c
/* 概念示例：每次系统调用接收多个 datagram，减少 per-packet 开销 */
int n = recvmmsg(fd, msgs, batch_size, MSG_DONTWAIT, NULL);
for (int i = 0; i < n; ++i) enqueue_or_drop_by_deadline(msgs[i]);
```

`SO_RCVBUF` 可以吸收短突发，但不是无穷队列。对于控制、传感器和行情类消息，超过最大年龄的包往往应直接丢弃；用更多 buffer 把它们留到过期再处理，只会让系统看起来“没丢包”，实际决策更晚。

## 用协议帮内核做正确的事

每个 UDP 消息都应包含序列号、发送时间和可选的业务 epoch。接收端据此统计真实丢包、检测乱序、拒绝过期数据，并在连续丢失超过阈值时触发重同步或安全降级。UDP 给了你更少的内核语义，也要求你把真正需要的可靠性与时效性明确写进协议。

参考：[udp(7)](https://man7.org/linux/man-pages/man7/udp.7.html) · [recvmmsg(2)](https://man7.org/linux/man-pages/man2/recvmmsg.2.html)
