---
title: 串口帧协议：解决粘包、丢字节与错误恢复
date: 2026-05-28 20:00:00
permalink: /2026/07/29/uart-frame-protocol/
categories: [技术, 嵌入式]
tags: [UART, 帧协议, CRC]
---

UART 只提供连续字节流，不知道一条消息从哪里开始、在哪里结束。可靠协议必须自行定义帧头、长度、类型、序号、负载和校验；接收端按字节推进状态机，遇到非法长度、超时或 CRC 错误后丢弃当前候选帧并重新同步。

<div class="note-flow"><span>DMA/中断接收字节</span><i>→</i><span>寻找帧头</span><i>→</i><span>读取长度与负载</span><i>→</i><span>校验 CRC</span><i>→</i><span>分发或重新同步</span></div>

<figure class="note-visual"><figcaption><span>解析图</span>接收状态机永远要能从坏数据中回到寻找帧头的状态。</figcaption><div class="note-map"><span><b>接收缓冲</b><small>DMA 或中断把字节放进有界环形队列，业务不直接读寄存器。</small></span><span><b>帧头</b><small>需要足够容易识别，必要时对负载做转义或编码。</small></span><span><b>长度字段</b><small>先检查最大值，避免坏字节诱导超大分配或等待。</small></span><span><b>类型与序号</b><small>支持多种消息、请求响应匹配和重复帧检测。</small></span><span><b>CRC</b><small>校验通过后才交给业务层，失败立即进入重同步。</small></span><span><b>帧间超时</b><small>半帧长时间不完整时丢弃，避免状态机永久卡住。</small></span></div></figure>

## 解析器要逐字节前进，也要随时能后退

每次输入一个字节后，状态机只做有限工作：寻找帧头、收集固定头、校验长度、收集负载、核对 CRC。任何非法长度、未知类型或 CRC 失败都应回到同步状态，而不是继续沿用一部分旧字段。若帧头可能出现在负载中，需要采用转义、长度加 CRC 或 COBS/SLIP 一类编码，不能只靠“这个字节一般不会出现”。

## 传输语义要补在帧格式之外

CRC 只能发现传输错误，不能保证消息恰好执行一次。控制命令可以带序号，接收端保存最近处理过的序号并返回对应结果；发送端按超时重试时就不会因为重复包重复执行危险动作。对于流量控制，还要定义接收缓冲满时丢弃、暂停还是覆盖，避免高频数据把关键命令淹没。

参考：[EmbedSummary](https://github.com/ZhengNianLi/EmbedSummary)
