---
title: SocketCAN 故障注入怎么做：先说明模拟了哪一层
date: 2026-08-22 20:30:00
permalink: /2026/08/22/socketcan-fault-injection-boundaries/
categories: [技术, 项目方法]
tags: [SocketCAN, CAN, 故障注入, 测试]
---

CAN 控制链的异常处理不能只靠拔线测试，但软件故障注入也容易被过度解读。vcan、SocketCAN 错误消息和真实控制器状态属于不同层，测试报告必须说清楚注入点和能够证明的范围。

<div class="note-flow"><span>选择故障层级</span><i>→</i><span>注入可识别事件</span><i>→</i><span>观察状态机</span><i>→</i><span>验证恢复与发送上界</span><i>→</i><span>声明边界</span></div>

<div class="note-map"><span><b>应用层</b><small>ACK、反馈与 watchdog</small></span><span><b>SocketCAN</b><small>错误消息接口</small></span><span><b>物理总线</b><small>控制器与电气状态</small></span></div>

## 软件层适合验证什么

可复现注入适合覆盖 ACK 丢失、迟到、重复、反馈停滞、watchdog 超时、解码错误和应用可见的错误消息。它能验证上层是否进入预期状态、停止继续发送业务命令、清理 pending 请求，并按策略恢复。

物理 CAN 的 Error Flag、TEC/REC、error-passive 和 bus-off 由控制器与总线行为决定。Linux 带错误标记的 message frame 是向应用报告状态的接口，不能把注入这类消息写成“复现了真实电气故障”。vcan 同样不能模拟仲裁、位时序、终端电阻和总线负载。

## 停止路径要有可测上界

故障发生后，测试可以统计停车相关命令是否停止增长、是否在有限步骤内进入保守状态，以及恢复前是否清空旧请求。这里的“停止”是软件发送与状态机语义，不代表物理制动距离或安全等级。

## 恢复比报错更难

恢复流程应重新初始化协议状态，处理迟到帧，确认设备新鲜状态，再允许业务命令恢复。直接把错误标志清掉并继续运行，可能让旧 ACK 或旧反馈污染下一轮请求。

## 参考资料

- [Linux SocketCAN](https://www.kernel.org/doc/html/latest/networking/can.html)
- [CAN error handling](https://www.bosch-semiconductors.com/media/ip_modules/pdf_2/can2spec.pdf)

## 证据边界

本文不包含具体 CAN ID、帧格式、故障数量、超时阈值、设备型号或内部测试结果，只讨论分层验证原则。
