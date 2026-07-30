---
title: Modbus RTU：帧边界、CRC 与寄存器模型
date: 2026-06-19 14:00:00
permalink: /2026/07/29/embedded-modbus/
categories: [技术, 嵌入式]
tags: [Modbus, RS485, CRC]
---

Modbus RTU 在 RS-485 上采用请求响应模式。帧由站地址、功能码、数据和 CRC16 组成；接收端通常依靠至少 3.5 个字符时间的空闲间隔识别帧边界。协议本身很朴素，工程问题多出在寄存器约定、串口时序和半双工方向控制。

<div class="note-flow"><span>主站发送请求</span><i>→</i><span>从站校验地址与 CRC</span><i>→</i><span>执行寄存器操作</span><i>→</i><span>返回响应或异常码</span><i>→</i><span>主站超时重试</span></div>

<figure class="note-visual"><figcaption><span>帧图</span>报文合法、寄存器语义正确和 RS-485 时序正确，三者缺一不可。</figcaption><div class="note-map"><span><b>站地址</b><small>决定从站是否响应，广播帧不应期待普通回复。</small></span><span><b>功能码</b><small>定义读写哪类寄存器，以及异常响应的解释方式。</small></span><span><b>寄存器地址</b><small>文档中的 4xxxx 标号和协议偏移常常不是同一个数。</small></span><span><b>数据编码</b><small>16 位寄存器内的字节序和多寄存器顺序必须固定。</small></span><span><b>CRC16</b><small>只能说明传输未发现错误，不说明值在业务范围内。</small></span><span><b>DE/RE</b><small>半双工收发方向切换必须等到最后一位真正发完。</small></span></div></figure>

## 先写一页寄存器契约

每个寄存器应写清地址偏移、读写权限、单位、比例系数、范围、默认值和字节序。温度到底是 `253` 表示 25.3 度，还是 IEEE 754 浮点数的一半，都不能靠两端“默认理解”。对 32 位整数和浮点数，还要规定两个 16 位寄存器的先后顺序。

设备收到 CRC 正确但数值越界的请求时，也应返回明确错误或拒绝执行。不要因为“报文格式正确”就把任何参数直接写进控制配置。

## 超时、重试和方向切换要一起测

主站应给每类请求设置合理超时并限制重试次数，避免一台离线设备拖住整条轮询链。RS-485 发送后不能过早拉低 DE，否则尾部字节会丢；切回接收也不能太晚，否则会错过从站回复。用示波器或串口抓包同时看 UART 字节和 DE 引脚，比只看软件日志更容易定位问题。

参考：[EmbedSummary](https://github.com/ZhengNianLi/EmbedSummary)
