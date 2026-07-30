---
title: CAN 总线：仲裁、错误处理与可靠通信
date: 2026-06-18 14:00:00
permalink: /2026/07/29/embedded-can/
categories: [技术, 嵌入式]
tags: [CAN, 仲裁, 总线]
---

CAN 是多节点共用的一条总线，消息 ID 同时表示这帧是什么和它有多高优先级。多个节点一起发送时，显性位会覆盖隐性位，ID 更小的帧继续发送，其他节点停下来，等总线空闲后再试。这种逐位仲裁没有把低优先级帧“撞坏”，但它会拉长低优先级消息的等待时间。

<div class="note-flow"><span>多个节点同时发送</span><i>→</i><span>逐位仲裁</span><i>→</i><span>最高优先级继续</span><i>→</i><span>CRC/ACK 校验</span><i>→</i><span>错误计数与重发</span></div>

<figure class="note-visual"><figcaption><span>总线图</span>一个可靠的 CAN 设计同时要看优先级、时间和错误状态。</figcaption><div class="note-map"><span><b>消息 ID</b><small>较小的 ID 在仲裁阶段获胜，也应对应更紧的截止期。</small></span><span><b>位时序</b><small>bitrate、采样点和传播延迟必须在所有节点一致。</small></span><span><b>终端电阻</b><small>总线两端通常需要匹配终端，支线过长会引入反射。</small></span><span><b>ACK</b><small>只说明至少有节点正确接收，不说明执行器已完成动作。</small></span><span><b>错误计数</b><small>发送和接收错误会推动节点进入不同错误状态。</small></span><span><b>bus-off</b><small>节点停止参与总线，恢复策略必须受控且可追踪。</small></span></div></figure>

## 仲裁优先级要按截止期分配

给消息分配 ID 时，先列出控制周期、最大允许等待时间和报文长度，再决定优先级。急停、状态闭锁等帧不应与低频诊断、配置下发使用同一优先级。总线在高负载时，高优先级帧仍然会被当前正在发送的一帧挡住，因此预算里还要包含最大帧时间和可能的重发。

CAN 的 ACK 也容易被误读。它证明有接收节点确认了位级正确性，不证明接收方接受了业务命令，更不证明电机已经运动。需要业务闭环时，应定义独立的状态反馈、序号和超时。

## 出错时先分层，不要直接重发

排查顺序通常是物理层、控制器配置、总线状态和应用协议：确认线缆、地线、终端电阻和收发器供电；确认所有节点 bitrate 与采样点一致；读取 error-active、error-passive、bus-off 状态和错误计数；最后再检查 ID、字节序、长度和信号范围。bus-off 自动恢复可能掩盖持续的物理问题，恢复前应记录原因并限制重试频率。

参考：[EmbedSummary](https://github.com/ZhengNianLi/EmbedSummary)
