---
title: 嵌入式 RTOS 选型：不要只比较功能列表
date: 2026-07-29 14:16:00
categories: [技术, 嵌入式]
tags: [RTOS, FreeRTOS, RT-Thread]
---

RTOS 选型应同时评估实时性、内存占用、驱动生态、网络组件、许可证、调试工具和团队经验。小型控制器可从 FreeRTOS 入手，需要丰富组件与设备框架时可评估 RT-Thread、Zephyr 等。

<div class="note-flow"><span>明确硬实时与资源约束</span><i>→</i><span>筛选架构和工具链支持</span><i>→</i><span>验证驱动与中间件</span><i>→</i><span>测量时延和内存</span><i>→</i><span>评估维护与许可证</span></div>

参考：[嵌入式系统资源汇总](https://github.com/ZhengNianLi/EmbedSummary)
