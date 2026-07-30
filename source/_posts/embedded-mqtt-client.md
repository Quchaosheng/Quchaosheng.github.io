---
title: 嵌入式 MQTT：连接、会话、QoS 与离线恢复
date: 2026-07-14 14:10:00
permalink: /2026/07/29/embedded-mqtt-client/
categories: [技术, 嵌入式网络]
tags: [MQTT, IoT, QoS]
---

MQTT 以 Broker 为中心发布订阅。设备建立 TCP/TLS 连接并订阅主题，通过 keepalive 维持会话；QoS 0/1/2 分别提供至多一次、至少一次和恰好一次的交付协议。

<div class="note-flow"><span>建立 TCP/TLS</span><i>→</i><span>CONNECT 与鉴权</span><i>→</i><span>订阅/发布主题</span><i>→</i><span>QoS 确认与重试</span><i>→</i><span>断线退避并恢复会话</span></div>

设备端应处理消息去重、持久会话、离线队列、证书更新和随机退避。参考：[mqttclient](https://github.com/jiejieTop/mqttclient)
