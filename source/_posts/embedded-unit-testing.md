---
title: 嵌入式单元测试：把硬件依赖隔离在边界之外
date: 2026-05-06 14:00:00
permalink: /2026/07/29/embedded-unit-testing/
categories: [技术, 嵌入式]
tags: [单元测试, Unity, Mock]
---

固件很难在目标板上覆盖所有异常路径，但大部分业务规则其实不需要真实寄存器就能验证。把决策逻辑和硬件适配隔开后，主机测试可以快速覆盖超时、重试、输入边界和状态转换；目标板测试则集中验证驱动、时序、电平和真实设备行为。

<div class="note-flow"><span>拆分纯逻辑与硬件适配</span><i>→</i><span>为依赖建立 Mock</span><i>→</i><span>主机运行单元测试</span><i>→</i><span>目标板集成测试</span><i>→</i><span>CI 汇总覆盖与回归</span></div>

<figure class="note-visual"><figcaption><span>测试边界</span>测试替身放在硬件边界，业务规则就可以脱离板子运行。</figcaption><div class="note-map"><span><b>纯逻辑</b><small>状态机、协议解析、参数校验和重试策略适合主机单测。</small></span><span><b>接口边界</b><small>把时钟、存储、网络和寄存器访问抽象成小接口。</small></span><span><b>Mock/Fake</b><small>可控制返回值、延迟和错误，专门覆盖异常分支。</small></span><span><b>构建配置</b><small>主机和目标机使用相同核心逻辑，避免测试另一份代码。</small></span><span><b>集成测试</b><small>目标板验证 DMA、时钟、协议电气特性和真实外设。</small></span><span><b>回归记录</b><small>失败用例和缺陷修复都应进入持续运行的测试集。</small></span></div></figure>

## 让依赖从函数参数或接口进入

例如把 `now()`、`storage_read()`、`can_send()` 放在接口中，业务对象只依赖这些能力，而不是直接读 SysTick 寄存器或调用厂商库。测试时传入可控的假时钟和假总线，就能稳定地复现“正好超时”“发送失败两次后恢复”等情况。

mock 的目标不是复制真实硬件，而是给出可预期的输入并验证交互。过度模拟每个寄存器细节会让测试和实现一起变脆；底层驱动的真实时序仍应留给目标板集成测试。

## 失败路径比成功路径更值得覆盖

优先补齐输入长度异常、CRC 失败、队列满、设备未响应、掉电恢复和重试上限等路径。每次线上故障修复后，都把最小复现加进测试。这样单元测试不是一份“覆盖率报告”，而是防止同一个问题再次回来的工具。

参考：[Unity](https://github.com/ThrowTheSwitch/Unity)
