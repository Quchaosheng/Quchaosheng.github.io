---
title: 嵌入式低功耗：从功耗预算到睡眠唤醒
date: 2026-07-16 14:10:00
permalink: /2026/07/29/embedded-low-power/
categories: [技术, 嵌入式]
tags: [低功耗, 睡眠, 电源管理]
---

低功耗优化先建立各状态电流与驻留时间预算，再减少唤醒频率、关闭未使用时钟和外设，并选择满足唤醒延迟的最深睡眠状态。

<div class="note-flow"><span>任务完成并计算下一截止期</span><i>→</i><span>关闭外设与时钟</span><i>→</i><span>进入睡眠</span><i>→</i><span>RTC/GPIO/通信唤醒</span><i>→</i><span>恢复上下文与任务</span></div>

测量必须覆盖板级漏电、调试器和外设反向供电；平均电流比最低睡眠电流更有意义。参考：[EmbedSummary](https://github.com/ZhengNianLi/EmbedSummary)
