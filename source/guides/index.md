---
title: 核心文章
date: 2026-07-30 16:10:00
layout: page
description: 面向 Linux 实时性、AI 机器人和嵌入式交付的十篇核心技术文章。
---

<div class="page-lead"><p class="section-kicker">先读这些</p><p>刚开始看时，可以先读这十篇。每篇都在回答一个常见问题，读完后再按[学习路径](/paths/)补相关内容。</p></div>

<div class="resource-list"><article class="resource-item"><p class="section-kicker">01 · Linux 实时性</p><h3><a href="/2026/07/30/linux-preempt-rt/">PREEMPT_RT：Linux 怎样变成可抢占的实时内核</a></h3><p>看 RT 内核改了哪些路径，还有哪些延迟它处理不了。</p></article><article class="resource-item"><p class="section-kicker">02 · Linux 实时性</p><h3><a href="/2026/07/30/linux-cpu-isolation/">CPU 隔离：为实时任务留出安静的核心</a></h3><p>把 CPU、IRQ、RCU、workqueue 和后台任务怎么分开。</p></article><article class="resource-item"><p class="section-kicker">03 · 测量</p><h3><a href="/2026/07/30/cyclictest-latency/">cyclictest：怎样测量 Linux 实时调度延迟</a></h3><p>用周期、亲和性和直方图测线程到底晚醒了多久。</p></article><article class="resource-item"><p class="section-kicker">04 · 排查</p><h3><a href="/2026/07/30/linux-osnoise-tracer/">osnoise tracer：把实时抖动拆成可解释的噪声</a></h3><p>把尖峰和 IRQ、softirq、调度、NMI/SMI 等事件对上。</p></article><article class="resource-item"><p class="section-kicker">05 · 机器人平台</p><h3><a href="/2026/07/30/jetson-robot-deployment/">Jetson 机器人部署：功耗、算力与实时控制怎样分工</a></h3><p>分开看 GPU 推理、ROS 2 和 MCU/RT 控制该负责什么。</p></article><article class="resource-item"><p class="section-kicker">06 · 相机数据</p><h3><a href="/2026/07/30/isaac-ros-nitros-zero-copy/">Isaac ROS NITROS：相机数据怎样少拷贝地送进 GPU</a></h3><p>找出图像在哪儿复制、在哪儿排队，以及怎么测到结果。</p></article><article class="resource-item"><p class="section-kicker">07 · 推理</p><h3><a href="/2026/07/30/tensorrt-robot-inference/">TensorRT 机器人推理：从训练模型到稳定延迟</a></h3><p>把预处理、排队、推理和控制消费放到同一条时间线上。</p></article><article class="resource-item"><p class="section-kicker">08 · 交叉编译</p><h3><a href="/2026/07/29/cmake-cross-compilation/">CMake 交叉编译：工具链文件决定目标环境</a></h3><p>让 CMake 始终找目标机的编译器、头文件和库。</p></article><article class="resource-item"><p class="section-kicker">09 · 系统镜像</p><h3><a href="/2026/07/29/buildroot-system-image/">Buildroot：生成可复现的嵌入式 Linux 系统镜像</a></h3><p>把配置、外部树和 package 组织成可重复构建的镜像。</p></article><article class="resource-item"><p class="section-kicker">10 · 设备通信</p><h3><a href="/2026/07/29/embedded-can/">CAN 总线：仲裁、错误处理与可靠通信</a></h3><p>理解优先级、错误状态、bus-off 和恢复策略。</p></article></div>

读技术文章时，先确认它说的是代码、仿真还是实测，再决定能不能照搬到自己的设备上。
