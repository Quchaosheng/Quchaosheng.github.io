---
title: ACK 不等于完成：设备命令为什么要分三阶段
date: 2026-08-16 20:30:00
permalink: /2026/08/16/ack-is-not-completion/
categories: [技术, 项目方法]
tags: [设备协议, 状态机, 超时, 可靠性]
---

设备控制接口最容易产生的一类误判，是把“发送成功”“收到 ACK”和“设备达到目标状态”当成同一件事。它们属于不同边界，失败模式也不同。

<div class="note-flow"><span>请求已发送</span><i>→</i><span>收到匹配 ACK</span><i>→</i><span>回读设备终态</span><i>→</i><span>业务判定完成</span></div>

<div class="note-map"><span><b>request_id</b><small>绑定请求生命周期</small></span><span><b>ACK</b><small>只证明协议确认</small></span><span><b>终态</b><small>由新鲜反馈确认</small></span></div>

## 三个阶段各自证明什么

发送成功通常只表示数据进入本地协议栈或驱动队列。应用层 ACK 表示对端识别了某个请求，但可能尚未执行。终态反馈才回答设备是否到达目标位置、模式或清障状态。即使三者都成功，也不自动等同于物理安全认证。

因此，请求需要可匹配的标识。迟到 ACK 不能被下一次请求误收，重复响应也不能重复推进状态机。若设备明确返回 NACK，应按错误语义处理，而不是当作丢包继续盲目重试。

## 超时预算只应该有一个上限

多层调用常见的错误是每层都重新开始一个完整超时，导致总时长远超调用者预期。更稳妥的做法是父层维护总 deadline，子层只获得剩余预算。重试、等待 ACK 和终态确认都消耗同一预算。

取消同样需要分阶段：停止继续发送业务命令、发出可识别的停止请求、等待确认，并在截止期到达后进入保守状态。取消一个 Future 或 Action，并不能直接证明硬件已经停止。

## 故障注入应覆盖顺序问题

除了丢包，还应测试迟到、重复、乱序、ACK 后状态不变、设备重启和请求标识回绕。验证重点是状态机能否拒绝不属于当前请求的反馈，以及超时后是否仍可能有旧操作继续推进。

## 参考资料

- [ROS 2 Actions](https://docs.ros.org/en/jazzy/Concepts/Basic/About-Actions.html)
- [CAN protocol overview](https://www.kernel.org/doc/html/latest/networking/can.html)

## 证据边界

文中不包含任何私有帧格式、命令字、CAN ID、超时值或重试参数，只讨论通用的协议状态机设计。
