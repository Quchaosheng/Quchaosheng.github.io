---
title: NVIDIA GR00T：机器人基础模型在系统里应该放在哪一层
date: 2026-07-30 09:47:00
categories: [技术, AI机器人]
tags: [GR00T, VLA, 具身智能]
---

GR00T 面向机器人感知、语言理解与动作生成，代表视觉-语言-动作模型进入通用机器人任务的路线。它适合根据多模态输入生成高层意图或动作候选，但不应绕过碰撞检查、关节限制、速度限制和急停链路直接控制执行器。
<div class="note-flow"><span>接收视觉与语言指令</span><i>→</i><span>模型生成任务/动作候选</span><i>→</i><span>运行时校验场景与约束</span><i>→</i><span>控制器执行有限动作</span><i>→</i><span>反馈结果或安全停止</span></div>

落地时要记录模型版本、输入上下文、置信信息和动作审计日志，并为超时、分布外输入与错误理解设计确定性退路。模型能力越强，运行时边界越要清楚。参考：[NVIDIA Isaac GR00T](https://developer.nvidia.com/isaac/gr00t)
