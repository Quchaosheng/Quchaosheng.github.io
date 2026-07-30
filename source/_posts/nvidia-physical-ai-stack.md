---
title: NVIDIA Physical AI 技术栈：机器人从模型到执行器要经过什么
date: 2026-07-30 09:40:00
categories: [技术, AI机器人]
tags: [NVIDIA, Physical AI, ROS 2]
---

Physical AI 不是让大模型直接驱动电机，而是把数据生成、模型训练、仿真验证、边缘推理和机器人运行时串成闭环。NVIDIA 的 Cosmos、Isaac Sim、Isaac ROS、TensorRT 与 Jetson 分别覆盖其中不同阶段，ROS 2 和实时控制器负责把感知结果变成受约束的动作。
<div class="note-flow"><span>采集或生成机器人数据</span><i>→</i><span>训练感知/决策模型</span><i>→</i><span>Isaac Sim 仿真验证</span><i>→</i><span>Jetson 边缘推理</span><i>→</i><span>ROS 2 与控制器安全执行</span></div>

工程上要为每层定义输入、输出、时延和失败策略。模型置信度不足、通信超时或控制约束不满足时，应由确定性运行时降级或停车，而不是继续猜测。参考：[NVIDIA Robotics](https://developer.nvidia.com/robotics)
