---
title: Jetson 机器人部署：功耗、算力与实时控制怎样分工
date: 2026-07-30 09:41:00
categories: [技术, AI机器人]
tags: [Jetson, JetPack, CUDA]
---

Jetson 把 ARM CPU、NVIDIA GPU、内存和多媒体加速器集成在边缘平台上。JetPack 提供驱动、CUDA、TensorRT 和系统组件，适合在机器人本体完成视觉与 AI 推理，但 GPU 吞吐量不等于控制回路的最坏时延保证。
<div class="note-flow"><span>选择 JetPack 与功耗模式</span><i>→</i><span>部署模型和 ROS 2 节点</span><i>→</i><span>测量 CPU/GPU/内存负载</span><i>→</i><span>分离推理与实时控制</span><i>→</i><span>在温度稳定后复测长尾</span></div>

常见架构是 Jetson 负责感知、规划和任务编排，MCU 或独立实时线程负责电机闭环与急停。部署验收要覆盖降频、内存压力、相机丢帧和模型超时，而不只看平均 FPS。参考：[NVIDIA Jetson Documentation](https://docs.nvidia.com/jetson/)
