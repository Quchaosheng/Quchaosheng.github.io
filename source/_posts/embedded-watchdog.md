---
title: 看门狗：让系统从不可恢复故障中自动重启
date: 2026-07-29 14:30:00
categories: [技术, 嵌入式]
tags: [看门狗, 可靠性, 故障恢复]
---

看门狗是独立计时器，软件必须在系统健康时定期喂狗；超时则复位。正确设计应由健康监控任务汇总各关键任务心跳，而不是每个循环盲目喂狗。

<div class="note-flow"><span>各任务上报心跳</span><i>→</i><span>监控任务检查完整性</span><i>→</i><span>健康则喂狗</span><i>→</i><span>异常则停止喂狗</span><i>→</i><span>复位并记录原因</span></div>

启动后尽早启用硬件看门狗，重启前保存最小故障上下文，并防止连续重启循环。参考：[EmbedSummary](https://github.com/ZhengNianLi/EmbedSummary)
