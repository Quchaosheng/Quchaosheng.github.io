---
title: 视觉结果能看见还不够：任务准入需要持续 Guard
date: 2026-08-23 20:30:00
permalink: /2026/08/23/vision-admission-guards/
categories: [技术, 项目方法]
tags: [视觉, ROS 2, Guard, 任务安全]
---

视觉检测输出一个 ID 和位姿，并不意味着机器人任务可以立即执行。检测质量、时间新鲜度、坐标变换和连续性任何一项不满足，单帧结果都可能把偶然噪声变成控制动作。

我会把这些条件写成显式 Guard，并在任务运行期间持续检查，而不是只在启动瞬间检查一次。

<div class="note-flow"><span>检测候选</span><i>→</i><span>质量与身份</span><i>→</i><span>新鲜度与 TF</span><i>→</i><span>连续性</span><i>→</i><span>任务准入或取消</span></div>

<div class="note-map"><span><b>检测</b><small>身份与质量</small></span><span><b>时空</b><small>新鲜度与坐标变换</small></span><span><b>任务</b><small>持续准入与取消</small></span></div>

## Guard 应回答可审计问题

身份是否属于允许集合？检测质量是否达到当前场景要求？消息是否足够新？目标位姿能否变换到约定坐标系？相邻观测是否出现不合理跳变？这些条件应分别输出通过、失败和证据不足，而不是压成一个“vision_ok”。

连续性判断需要处理角度环绕和时间间隔。仅比较欧氏位置差可能漏掉姿态突变，只比较相邻帧也可能在帧率变化时误判。参数应来自标定与验证，而不是写进通用文章当作固定答案。

## Guard 需要贯穿任务

目标开始移动、相机断流或 TF 过期，都可能发生在任务已启动之后。执行器应在关键阶段重新评估 Guard，失败时触发取消或降级，并等待任务链路进入可确认状态。

取消导航或控制目标仍然只是软件协议动作，不等同于物理安全停止。真正的安全功能必须由独立机制承担。

## 参考资料

- [ROS 2 tf2](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Tf2.html)
- [Nav2 docking framework](https://docs.nav2.org/tutorials/docs/using_docking.html)

## 证据边界

本文不披露具体视觉模型、标签、阈值、标定参数、场景数据或设备信息，只讨论准入条件与持续验证的结构。
