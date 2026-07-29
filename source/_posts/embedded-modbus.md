---
title: Modbus RTU：帧边界、CRC 与寄存器模型
date: 2026-07-29 14:28:00
categories: [技术, 嵌入式]
tags: [Modbus, RS485, CRC]
---

Modbus RTU 在 RS-485 上采用主从请求响应。帧由地址、功能码、数据和 CRC16 组成，帧间隔依赖至少 3.5 个字符时间。

<div class="note-flow"><span>主站发送请求</span><i>→</i><span>从站校验地址与 CRC</span><i>→</i><span>执行寄存器操作</span><i>→</i><span>返回响应或异常码</span><i>→</i><span>主站超时重试</span></div>

工程中要统一寄存器地址偏移、字节序和浮点布局，并控制 RS-485 收发方向切换。参考：[EmbedSummary](https://github.com/ZhengNianLi/EmbedSummary)
