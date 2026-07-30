---
title: CAN 总线：仲裁、错误处理与可靠通信
date: 2026-06-18 14:00:00
permalink: /2026/07/29/embedded-can/
categories: [技术, 嵌入式]
tags: [CAN, 仲裁, 总线]
---

CAN 是多节点共用的一条总线，消息 ID 同时表示这帧是什么和它有多高优先级。多个节点一起发送时，显性位会覆盖隐性位，ID 更小的帧继续发送，其他节点停下来，等总线空闲后再试。

<div class="note-flow"><span>多个节点同时发送</span><i>→</i><span>逐位仲裁</span><i>→</i><span>最高优先级继续</span><i>→</i><span>CRC/ACK 校验</span><i>→</i><span>错误计数与重发</span></div>

终端电阻、位时序、采样点和总线负载都会影响通信。节点根据错误计数在 error-active、error-passive 和 bus-off 之间变化。排查问题时，先确认物理连接和位时序，再看错误计数和帧内容。参考：[EmbedSummary](https://github.com/ZhengNianLi/EmbedSummary)
