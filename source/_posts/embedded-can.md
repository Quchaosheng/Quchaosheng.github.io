---
title: CAN 总线：仲裁、错误处理与可靠通信
date: 2026-07-29 14:27:00
categories: [技术, 嵌入式]
tags: [CAN, 仲裁, 总线]
---

CAN 用消息 ID 表示优先级与含义。多个节点同时发送时，显性位覆盖隐性位，ID 更小的帧赢得无破坏仲裁，其他节点停止发送并稍后重试。

<div class="note-flow"><span>多个节点同时发送</span><i>→</i><span>逐位仲裁</span><i>→</i><span>最高优先级继续</span><i>→</i><span>CRC/ACK 校验</span><i>→</i><span>错误计数与重发</span></div>

终端电阻、位时序、采样点和总线负载决定可靠性。节点会依据错误计数进入 error-active、error-passive，最终 bus-off。参考：[EmbedSummary](https://github.com/ZhengNianLi/EmbedSummary)
