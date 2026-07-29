---
title: lwIP 数据路径：小内存设备如何运行 TCP/IP
date: 2026-07-29 14:24:00
categories: [技术, 嵌入式网络]
tags: [lwIP, TCP-IP, pbuf]
---

lwIP 用 `pbuf` 描述报文，通过网卡 netif 输入 IP 层，再分发到 UDP/TCP 与应用接口；发送方向则反向封装并交给驱动输出。

<div class="note-flow"><span>驱动收到帧</span><i>→</i><span>构造 pbuf</span><i>→</i><span>ethernet_input/IP</span><i>→</i><span>TCP/UDP PCB</span><i>→</i><span>应用回调或 socket</span></div>

重点配置内存池、TCP 窗口、线程模型与零拷贝边界。参考：[lwIP](https://www.nongnu.org/lwip/)
