---
title: 产测接口：让每块板子都能快速证明自己正常
date: 2026-07-05 10:00:00
permalink: /2026/07/29/manufacturing-test-interface/
categories: [技术, 嵌入式]
tags: [产测, 自检, 可追溯性]
---

产测不是让操作员逐条看串口输出，而是让每块板子走过同一套可追溯流程：识别硬件版本，检查供电、时钟、存储、通信和关键外设，记录测量值和错误码，再写入序列号与校准数据。结果必须能被工具稳定解析，才能发现批次问题和追踪售后故障。

<div class="note-flow"><span>扫描设备身份</span><i>→</i><span>执行分项自检</span><i>→</i><span>采集测量与错误码</span><i>→</i><span>写入序列号/校准值</span><i>→</i><span>上传结果并锁定量产配置</span></div>

<figure class="note-visual"><figcaption><span>产测图</span>把测试命令、原始测量和最终判定分层保存。</figcaption><div class="note-map"><span><b>身份读取</b><small>硬件版本、UID 和固件版本决定应执行哪套测试。</small></span><span><b>测试治具</b><small>供电、继电器、通信和传感器模拟要可控、可校准。</small></span><span><b>分项命令</b><small>每个命令只检查一类能力，并返回稳定错误码。</small></span><span><b>原始数据</b><small>保存电压、频率、ADC 值等测量，不只保存 pass/fail。</small></span><span><b>校准记录</b><small>写入后要读回核对，并绑定序列号和版本。</small></span><span><b>结果上传</b><small>将治具版本、时间和测试日志与设备身份一起归档。</small></span></div></figure>

## 输出格式必须适合机器读取

命令返回应有稳定字段，例如测试名、状态、错误码、测量值、单位和版本。人可读的说明可以附在后面，但不能是唯一结果。把“电压正常”改成 `supply_mv=4987 limit_low=4700 limit_high=5300 result=PASS`，后续才能统计分布和追查阈值变化。

测试也要区分“无法测试”“治具错误”和“产品不合格”。否则治具接触不良会被记成板子故障，数据越积越多也无法使用。

## 量产接口不等于永久后门

产测与售后诊断可以复用底层读写能力，但擦除、校准覆盖、输出驱动和安全配置等危险操作必须有权限、物理条件或一次性开关。量产后应缩小可执行命令集合，并记录任何维护模式的进入与退出。

参考：[letter-shell](https://github.com/NevermindZZT/letter-shell)
