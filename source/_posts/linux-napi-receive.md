---
title: NAPI：Linux 如何承受高并发收包
date: 2026-06-19 20:20:00
permalink: /2026/07/29/linux-napi-receive/
categories: [技术, Linux网络]
tags: [NAPI, 网卡驱动, 网络性能]
---

如果每个数据包都触发一次硬中断，高流量时 CPU 会花大量时间在“响应中断、保存现场、再响应下一个中断”，却没有时间真正处理数据，这就是中断风暴。反过来，持续轮询所有队列在低流量时又浪费 CPU。NAPI 采用混合模型：第一个包由中断提醒，随后驱动暂时关闭该队列中断，在软中断/NAPI poll 中按预算批量取包；队列清空后再恢复中断。它是 Linux 高吞吐收包的核心折中。

<div class="note-flow"><span>网卡产生接收中断</span><i>→</i><span>关闭队列中断</span><i>→</i><span>调度 NAPI poll</span><i>→</i><span>按 budget 批量收包</span><i>→</i><span>清空后重开中断</span></div>

## 驱动与协议栈怎样配合

驱动初始化时注册 `napi_struct` 及其 poll 回调。接收中断发生后，驱动确认设备并调度 NAPI；内核在 `NET_RX` softirq 中调用 poll，驱动从 RX ring 回收已经 DMA 完成的描述符，构造/关联 skb 后交给网络栈。poll 返回本次已完成包数；若队列已清空，驱动调用完成逻辑并重新启用中断；若仍有积压，则下一轮继续处理。

<div class="note-map"><span><b>RX ring</b><small>网卡 DMA 写入描述符指向的缓冲区，容量决定突发吸收能力</small></span><span><b>硬中断</b><small>低流量时及时唤醒 CPU；高流量时被暂时抑制</small></span><span><b>NAPI poll</b><small>在预算内批量回收包，减少每包中断成本</small></span><span><b>NET_RX softirq</b><small>驱动与协议栈的主要收包执行上下文</small></span><span><b>budget</b><small>防止一个队列长期独占 CPU，同时影响吞吐与尾延迟</small></span><span><b>ksoftirqd</b><small>软中断超过预算后接手，提示负载或分流可能失衡</small></span></div>

NAPI “批量”意味着天然存在吞吐与延迟取舍。较大 budget 可提高高流量效率，却可能让其他任务等待更久；过小则增加调度和中断开销。最佳值与包长、CPU、网卡队列数和应用处理能力有关，不是一个可盲目复制的常数。

## 如何从现象定位到 NAPI 层

先查看队列数和网卡统计，再看 softirq 是否集中在某几个 CPU。驱动暴露的计数器名称会随型号不同，但下面几项是常用起点：

```bash
ethtool -l eth0          # 查看/设置硬件队列通道能力
ethtool -S eth0          # 查看驱动统计，如 ring 丢包/队列错误
cat /proc/softirqs       # 观察 NET_RX 是否集中在某个 CPU
cat /proc/net/softnet_stat
```

如果 RX ring 丢包增长，说明包在驱动前已来不及接收；如果 `softnet_stat` 显示处理压力，说明协议栈/NAPI 路径可能过载；如果 socket 队列增长，则包已进入内核但应用消费太慢。三种问题的修复方向不同，不能都靠调大 buffer。

## 在实时系统中如何使用它

控制包通常追求较小的数据年龄，视频/日志流追求吞吐。可以让背景大流量队列、IRQ 和 NAPI 工作落在 housekeeping CPU，让关键流保留明确的 RX queue 与消费 CPU；但过度迁移也会增加跨核队列和 cache miss。每次调整都应记录“从网卡收到到应用消费”的时间戳，而不是只看 PPS 或带宽。

NAPI 不是某个驱动私有技巧，它是硬件队列、中断、softirq、GRO 和应用队列之间的协调点。理解这条路径后，网络性能问题才有分层排查的入口。

参考：[NAPI](https://docs.kernel.org/networking/napi.html) · [Linux networking scaling](https://docs.kernel.org/networking/scaling.html)
