---
title: 技术模块
date: 2026-07-31 10:30:00
layout: page
description: 按 Linux 实时性、ROS 2 机器人、嵌入式交付和 Physical AI 组织的技术阅读地图。
---

<div class="page-lead"><p class="section-kicker">TECHNICAL MODULES</p><p>这里不是按关键词堆文章，而是按工程问题组织阅读顺序。每个模块都从机制开始，经过测量或排查，最后落到项目和验收。</p></div>

<section class="module-hub-section">
  <div class="module-hub-heading"><p class="section-kicker">01 · LINUX REAL-TIME</p><h2>把延迟拆开，再谈实时性</h2><p>先识别抢占、调度、IRQ、内存和固件干扰，再用统一的负载与测量方法建立基线。</p></div>
  <div class="note-flow"><span>确认抢占模型</span><i>→</i><span>安排 CPU 与 IRQ</span><i>→</i><span>测量尾延迟</span><i>→</i><span>定位干扰</span><i>→</i><span>建立回归基线</span></div>
  <div class="module-hub-links"><a href="/2026/07/30/linux-preempt-rt/">PREEMPT_RT</a><a href="/2026/07/30/linux-cpu-isolation/">CPU 隔离</a><a href="/2026/07/30/cyclictest-latency/">cyclictest</a><a href="/2026/07/30/linux-osnoise-tracer/">osnoise</a><a href="/2026/07/30/realtime-regression-baseline/">回归基线</a></div>
</section>

<section class="module-hub-section">
  <div class="module-hub-heading"><p class="section-kicker">02 · ROS 2 ROBOT SYSTEMS</p><h2>让数据经过系统时仍然可信</h2><p>把 QoS、执行器、时间戳、感知结果、控制接口和故障恢复放在同一条数据链上检查。</p></div>
  <div class="note-flow"><span>定义数据契约</span><i>→</i><span>观察传输与排队</span><i>→</i><span>检查时间与年龄</span><i>→</i><span>连接控制接口</span><i>→</i><span>验证降级路径</span></div>
  <div class="module-hub-links"><a href="/2026/07/30/deepstream-multicamera-robot/">多相机数据流</a><a href="/2026/07/30/isaac-ros-nitros-zero-copy/">NITROS 与少拷贝</a><a href="/2026/07/30/isaac-ros-vslam-nvblox/">VSLAM 与 nvblox</a><a href="/2026/07/30/tensorrt-robot-inference/">TensorRT 推理</a><a href="/projects/robotraceopt/">RoboTraceOpt</a></div>
</section>

<section class="module-hub-section">
  <div class="module-hub-heading"><p class="section-kicker">03 · EMBEDDED DELIVERY</p><h2>从工具链走到可恢复的设备</h2><p>交叉编译、镜像、总线、看门狗和升级机制必须能够重复构建、诊断和回滚。</p></div>
  <div class="note-flow"><span>固定目标环境</span><i>→</i><span>生成系统镜像</span><i>→</i><span>定义通信边界</span><i>→</i><span>注入故障</span><i>→</i><span>确认恢复</span></div>
  <div class="module-hub-links"><a href="/2026/07/29/cmake-cross-compilation/">CMake 交叉编译</a><a href="/2026/07/29/buildroot-system-image/">Buildroot 镜像</a><a href="/2026/07/29/embedded-can/">CAN 通信</a><a href="/2026/07/29/embedded-watchdog/">看门狗恢复</a><a href="/2026/07/29/embedded-bootloader-update/">Bootloader 更新</a></div>
</section>

<section class="module-hub-section">
  <div class="module-hub-heading"><p class="section-kicker">04 · PHYSICAL AI</p><h2>把模型输出关进可验证的接口</h2><p>模型、视觉、定位和规划都只能提供带时间戳与置信边界的结果，控制侧还需要约束、超时和安全降级。</p></div>
  <div class="note-flow"><span>采集并校准</span><i>→</i><span>限制模型接口</span><i>→</i><span>测量推理尾延迟</span><i>→</i><span>验证任务约束</span><i>→</i><span>保留人工与急停</span></div>
  <div class="module-hub-links"><a href="/2026/07/30/jetson-robot-deployment/">Jetson 部署</a><a href="/2026/07/30/isaac-sim-sim-to-real/">Sim-to-Real</a><a href="/2026/07/30/nvidia-groot-robot-foundation-model/">GR00T</a><a href="/2026/07/30/nvidia-physical-ai-stack/">Physical AI 栈</a><a href="/projects/embodied-agent-runtime/">Embodied Agent Runtime</a></div>
</section>

<p class="module-hub-footer">想从一条明确的任务开始，可以先看<a href="/paths/">学习路径</a>；想快速筛选十篇基础文章，可以看<a href="/guides/">核心文章</a>。</p>
