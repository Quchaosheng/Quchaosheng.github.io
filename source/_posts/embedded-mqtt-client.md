---
title: 嵌入式 MQTT：连接、会话、QoS 与离线恢复
date: 2026-06-17 10:00:00
permalink: /2026/07/29/embedded-mqtt-client/
categories: [技术, 嵌入式网络]
tags: [MQTT, IoT, QoS]
---

MQTT 以 Broker 为中心发布订阅。设备先建立 TCP/TLS，再通过 CONNECT 协商会话并订阅或发布主题；keepalive 用于发现长时间失联。QoS 0、1、2 分别提供不同的交付协议，但“消息送达”与“设备已经完成动作”仍然是两层业务语义。

<div class="note-flow"><span>建立 TCP/TLS</span><i>→</i><span>CONNECT 与鉴权</span><i>→</i><span>订阅/发布主题</span><i>→</i><span>QoS 确认与重试</span><i>→</i><span>断线退避并恢复会话</span></div>

<figure class="note-visual"><figcaption><span>会话图</span>连接、会话、消息确认和业务执行应有各自的状态与超时。</figcaption><div class="note-map"><span><b>网络连接</b><small>TCP/TLS 成功只是传输通道建立，不等于 MQTT 已登录。</small></span><span><b>CONNECT</b><small>客户端标识、认证、keepalive 和会话选项在这里协商。</small></span><span><b>订阅状态</b><small>断线重连后是否自动恢复，取决于会话和订阅策略。</small></span><span><b>QoS 0</b><small>不等待确认，适合可丢弃的周期状态。</small></span><span><b>QoS 1/2</b><small>存在重传和重复处理语义，业务端必须按消息 ID 或序号去重。</small></span><span><b>退避重连</b><small>使用随机退避，避免大量设备同时重连压垮 Broker。</small></span></div></figure>

## QoS 选择要从业务后果开始

传感器周期上报通常允许丢掉旧值，QoS 0 更简单；配置和告警往往需要至少一次送达，但接收端必须能够处理重复消息。即使使用 QoS 2，也不应把它理解为“执行器一定只动作一次”：真正的命令执行需要业务序号、幂等设计、状态反馈和超时确认。

## 离线恢复不应把旧命令一股脑重放

设备断线时要区分应缓存在本地的遥测、可以丢弃的状态和绝不能延迟执行的命令。重连后先恢复身份和订阅，再按时间、序号和有效期决定哪些待发消息仍有价值。证书过期、DNS 失败、Broker 拒绝和网络抖动要分别统计，不能都归为“MQTT 连接失败”。

参考：[mqttclient](https://github.com/jiejieTop/mqttclient)
