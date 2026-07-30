---
title: USB 设备枚举：主机如何识别一个新设备
date: 2026-06-20 14:00:00
permalink: /2026/07/29/embedded-usb/
categories: [技术, 嵌入式]
tags: [USB, 枚举, 描述符]
---

USB 由主机控制总线。设备接入后，主机先检测端口状态、复位设备，再通过默认地址上的控制端点 EP0 读取描述符、分配新地址、选择配置并启用端点。设备“被电脑识别”不是一个瞬间，而是一连串必须严格符合规范的控制传输。

<div class="note-flow"><span>检测接入</span><i>→</i><span>端口复位</span><i>→</i><span>EP0 读取描述符</span><i>→</i><span>SET_ADDRESS</span><i>→</i><span>SET_CONFIGURATION 并启用端点</span></div>

<figure class="note-visual"><figcaption><span>枚举图</span>EP0 负责让主机了解设备，数据端点要等配置完成后再使用。</figcaption><div class="note-map"><span><b>接入检测</b><small>D+ 或 D- 上拉告诉主机设备速度和连接状态。</small></span><span><b>总线复位</b><small>主机让设备回到默认地址和初始状态。</small></span><span><b>设备描述符</b><small>先读取前几个字节，再按 bLength 请求完整描述符。</small></span><span><b>SET_ADDRESS</b><small>状态阶段完成后新地址才生效，时序不能提前。</small></span><span><b>配置与接口</b><small>主机选择配置，接口和端点描述符决定驱动绑定。</small></span><span><b>端点传输</b><small>bulk、interrupt、isochronous 各自有不同带宽和时序语义。</small></span></div></figure>

## 描述符是主机看到的产品说明书

设备、配置、接口、端点和字符串描述符的长度字段必须准确，且所有总长度相互一致。主机通常会以不同长度多次读取描述符，固件不能假定它一定一次读完。类、子类、协议和端点类型也要匹配实际功能，否则设备可能枚举成功却绑定到错误驱动。

## 失败时按物理层到控制传输排查

先确认供电、D+/D- 走线、ESD 器件、USB 时钟精度和连接检测；再抓取主机发出的 SETUP 包，检查设备有没有按请求长度返回数据。EP0 最大包、`SET_ADDRESS` 生效时机和配置描述符总长度是最常见的逻辑问题。不要只靠系统弹出的“未知 USB 设备”判断根因。

参考：[DAPLink](https://github.com/ARMmbed/DAPLink)
