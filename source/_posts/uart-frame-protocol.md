---
title: 串口帧协议：解决粘包、丢字节与错误恢复
date: 2026-07-18 09:30:00
permalink: /2026/07/29/uart-frame-protocol/
categories: [技术, 嵌入式]
tags: [UART, 帧协议, CRC]
---

可靠串口协议应包含帧头、长度、类型、序号、负载和校验。接收端按字节推进状态机，遇到非法长度或 CRC 错误时重新搜索帧头。

<div class="note-flow"><span>DMA/中断接收字节</span><i>→</i><span>寻找帧头</span><i>→</i><span>读取长度与负载</span><i>→</i><span>校验 CRC</span><i>→</i><span>分发或重新同步</span></div>

帧头转义、最大长度、超时和序号能提高噪声环境下的恢复能力。参考：[EmbedSummary](https://github.com/ZhengNianLi/EmbedSummary)
