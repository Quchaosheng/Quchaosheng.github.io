---
title: RT-Thread SAL：屏蔽不同网络协议栈的 Socket 差异
date: 2026-07-30 09:06:00
categories: [技术, RT-Thread]
tags: [SAL, Socket, 网络]
---

Socket Abstraction Layer 为 lwIP、AT 设备和其他网络后端提供统一 BSD Socket 接口，使应用不依赖具体协议栈或通信模组。

<div class="note-flow"><span>应用调用 socket API</span><i>→</i><span>SAL 查找协议族与后端</span><i>→</i><span>分派到 lwIP/AT Socket</span><i>→</i><span>网络设备收发</span><i>→</i><span>统一错误码返回</span></div>

多网卡场景要明确默认路由、DNS 与连接绑定；后端切换不代表所有非阻塞和错误语义完全一致。参考：[RT-Thread](https://github.com/RT-Thread/rt-thread)
