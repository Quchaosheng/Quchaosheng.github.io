---
title: 学习路径
date: 2026-07-30 15:14:00
layout: page
---

<div class="page-lead">
  <p class="section-kicker">怎么读</p>
  <p>不知道先看哪篇时，从这里开始。每条路径按实际做事的顺序排：先弄清问题，再动手测，最后再把方案放进系统里。</p>
</div>

<section class="learning-path"><p class="section-kicker">路径一 · Linux 实时性</p><h2>先把延迟测明白</h2><p class="path-summary">不要先忙着调优先级。先弄清高优先级线程会被什么卡住，再测最长延迟，最后处理干扰源。</p><div class="note-flow"><span>看抢占限制</span><i>→</i><span>安排 CPU</span><i>→</i><span>测最长延迟</span><i>→</i><span>找干扰源</span><i>→</i><span>重复测试</span></div><ol class="path-steps"><li><a href="/2026/07/30/linux-preempt-rt/">PREEMPT_RT：Linux 怎样变成可抢占的实时内核</a><span>先看哪些内核路径仍会挡住高优先级线程。</span></li><li><a href="/2026/07/30/linux-cpu-isolation/">CPU 隔离：为实时任务留出安静的核心</a><span>把 housekeeping、IRQ、RCU 和关键线程分开安排。</span></li><li><a href="/2026/07/30/cyclictest-latency/">cyclictest：怎样测量 Linux 实时调度延迟</a><span>记录最大值和直方图，不只看平均值。</span></li><li><a href="/2026/07/30/linux-osnoise-tracer/">osnoise tracer：把实时抖动拆成可解释的噪声</a><span>检查 IRQ、softirq、调度或固件带来的干扰。</span></li><li><a href="/2026/07/30/realtime-regression-baseline/">实时回归测试：把一次调优变成可持续的延迟基线</a><span>保存环境和原始数据，方便下次比较。</span></li></ol></section>

<section class="learning-path"><p class="section-kicker">路径二 · ROS 2 与机器人</p><h2>让感知结果能安全地用起来</h2><p class="path-summary">视觉、推理、定位和控制会互相影响。这里先讲数据怎么走，再讲怎样避免把过期或不可靠的结果送到控制侧。</p><div class="note-flow"><span>安排平台资源</span><i>→</i><span>少拷贝图像</span><i>→</i><span>定位与建图</span><i>→</i><span>测推理延迟</span><i>→</i><span>排查问题</span></div><ol class="path-steps"><li><a href="/2026/07/30/jetson-robot-deployment/">Jetson 机器人部署：功耗、算力与实时控制怎样分工</a><span>先分开 GPU 推理和 MCU / RT 控制的职责。</span></li><li><a href="/2026/07/30/isaac-ros-nitros-zero-copy/">Isaac ROS NITROS：相机数据怎样少拷贝地送进 GPU</a><span>看图像在哪儿复制、在哪儿排队。</span></li><li><a href="/2026/07/30/isaac-ros-vslam-nvblox/">Isaac ROS Visual SLAM 与 nvblox：机器人怎样定位并理解空间</a><span>分清姿态、地图和规划输入分别做什么。</span></li><li><a href="/2026/07/30/tensorrt-robot-inference/">TensorRT 机器人推理：从训练模型到稳定延迟</a><span>测量结果从相机到控制侧到底用了多久。</span></li><li><a href="/projects/robotraceopt/">RoboTraceOpt：ROS 2 跨层运行时诊断与优化</a><span>把应用事件、trace、调度和 ACK 放在一起看。</span></li></ol></section>

<section class="learning-path"><p class="section-kicker">路径三 · 嵌入式交付</p><h2>把程序变成能上板的系统</h2><p class="path-summary">从交叉编译到系统镜像，再到通信和故障恢复。每一步都要能在另一台机器、另一块板子上重复。</p><div class="note-flow"><span>写工具链文件</span><i>→</i><span>生成系统镜像</span><i>→</i><span>选任务模型</span><i>→</i><span>定总线协议</span><i>→</i><span>处理故障</span></div><ol class="path-steps"><li><a href="/2026/07/29/cmake-cross-compilation/">CMake 交叉编译：工具链文件决定目标环境</a><span>防止配置时误用宿主机库。</span></li><li><a href="/2026/07/29/buildroot-system-image/">Buildroot：生成可复现的嵌入式 Linux 系统镜像</a><span>把工具链、内核、rootfs 和服务一起做成镜像。</span></li><li><a href="/2026/07/29/embedded-rtos-selection/">嵌入式 RTOS 选型：不要只比较功能列表</a><span>按实时性、内存、调试和团队条件来选。</span></li><li><a href="/2026/07/29/embedded-can/">CAN 总线：仲裁、错误处理与可靠通信</a><span>先理解优先级、错误状态和总线恢复。</span></li><li><a href="/2026/07/29/embedded-watchdog/">看门狗：让系统从不可恢复故障中自动重启</a><span>由健康检查决定是否复位。</span></li></ol></section>

想直接看十篇重点文章，去[核心文章](/guides/)；想找外部文档，去[精选阅读](/reading/)；按主题翻找时可以回到[技术地图](/technology/)。
