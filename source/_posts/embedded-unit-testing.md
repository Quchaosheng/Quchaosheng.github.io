---
title: 嵌入式单元测试：把硬件依赖隔离在边界之外
date: 2026-06-14 14:00:00
permalink: /2026/07/29/embedded-unit-testing/
categories: [技术, 嵌入式]
tags: [单元测试, Unity, Mock]
---

可测试固件应把业务逻辑与寄存器、时钟和 I/O 隔离，通过接口注入模拟依赖。大部分测试在主机高速运行，少量硬件在环测试验证真实时序。

<div class="note-flow"><span>拆分纯逻辑与硬件适配</span><i>→</i><span>为依赖建立 Mock</span><i>→</i><span>主机运行单元测试</span><i>→</i><span>目标板集成测试</span><i>→</i><span>CI 汇总覆盖与回归</span></div>

参考：[Unity](https://github.com/ThrowTheSwitch/Unity)
