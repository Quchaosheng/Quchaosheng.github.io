---
title: 学习路径
date: 2026-07-30 15:14:00
layout: page
---

<div class="page-lead">
  <p class="section-kicker">LEARNING PATHS</p>
  <p>文章很多时，最容易丢的是先后关系。这里按工程问题而非标签排列：先建立模型，再做测量，最后把结论放回实际系统。</p>
</div>

<section class="learning-path"><p class="section-kicker">PATH 01 · REAL-TIME LINUX</p><h2>Linux 实时性：从可抢占到可验收</h2><p class="path-summary">目标不是把线程优先级调高，而是知道延迟由谁占走、如何复测，以及什么条件下能把结果称为通过。</p><div class="note-flow"><span>理解抢占边界</span><i>→</i><span>隔离 CPU 与噪声</span><i>→</i><span>测量尾延迟</span><i>→</i><span>定位干扰源</span><i>→</i><span>建立回归基线</span></div><ol class="path-steps"><li><a href="/2026/07/30/linux-preempt-rt/">PREEMPT_RT：Linux 怎样变成可抢占的实时内核</a><span>先理解何处仍可能阻塞高优先级任务。</span></li><li><a href="/2026/07/30/linux-cpu-isolation/">CPU 隔离：为实时任务留出安静的核心</a><span>把 housekeeping、IRQ、RCU 与关键线程的归属拆开看。</span></li><li><a href="/2026/07/30/cyclictest-latency/">cyclictest：怎样测量 Linux 实时调度延迟</a><span>建立可解释的周期延迟测量，而非只看平均值。</span></li><li><a href="/2026/07/30/linux-osnoise-tracer/">osnoise tracer：把实时抖动拆成可解释的噪声</a><span>从“慢了”转向 IRQ、softirq、调度或固件等证据。</span></li><li><a href="/2026/07/30/realtime-regression-baseline/">实时回归测试：把一次调优变成可持续的延迟基线</a><span>保留环境、负载、原始数据与失败现场。</span></li></ol></section>

<section class="learning-path"><p class="section-kicker">PATH 02 · ROBOT DATA TO ACTION</p><h2>ROS 2 与 AI 机器人：从数据管线到可控动作</h2><p class="path-summary">视觉、推理、定位和控制常被当作独立模块；实际交付时需要同时处理数据年龄、GPU 拷贝、任务契约和端到端时序。</p><div class="note-flow"><span>平台与资源布局</span><i>→</i><span>减少数据搬运</span><i>→</i><span>定位与建图</span><i>→</i><span>稳定推理</span><i>→</i><span>任务诊断与证据</span></div><ol class="path-steps"><li><a href="/2026/07/30/jetson-robot-deployment/">Jetson 机器人部署：功耗、算力与实时控制怎样分工</a><span>先划分 GPU 推理和 MCU / RT 控制职责。</span></li><li><a href="/2026/07/30/isaac-ros-nitros-zero-copy/">Isaac ROS NITROS：相机数据怎样少拷贝地送进 GPU</a><span>理解吞吐改善与数据生命周期的边界。</span></li><li><a href="/2026/07/30/isaac-ros-vslam-nvblox/">Isaac ROS Visual SLAM 与 nvblox：机器人怎样定位并理解空间</a><span>把姿态、地图和规划输入区分开。</span></li><li><a href="/2026/07/30/tensorrt-robot-inference/">TensorRT 机器人推理：从训练模型到稳定延迟</a><span>关注持续输入下的结果年龄与控制路径。</span></li><li><a href="/projects/robotraceopt/">RoboTraceOpt：ROS 2 跨层运行时诊断与优化</a><span>把应用事件、trace、调度与 ACK 放回同一条证据链。</span></li></ol></section>

<section class="learning-path"><p class="section-kicker">PATH 03 · EMBEDDED DELIVERY</p><h2>嵌入式系统：从构建产物到故障恢复</h2><p class="path-summary">可交付的嵌入式系统不是一段能编译的程序，而是一套能交叉构建、通信、升级、故障恢复并持续复现的产物。</p><div class="note-flow"><span>声明目标工具链</span><i>→</i><span>生成系统镜像</span><i>→</i><span>选择任务模型</span><i>→</i><span>建立总线协议</span><i>→</i><span>设计恢复路径</span></div><ol class="path-steps"><li><a href="/2026/07/29/cmake-cross-compilation/">CMake 交叉编译：工具链文件决定目标环境</a><span>避免配置阶段悄悄混入宿主机库。</span></li><li><a href="/2026/07/29/buildroot-system-image/">Buildroot：生成可复现的嵌入式 Linux 系统镜像</a><span>把工具链、boot、内核、rootfs 和服务收敛为产物。</span></li><li><a href="/2026/07/29/embedded-rtos-selection/">嵌入式 RTOS 选型：不要只比较功能列表</a><span>从实时性、生态、内存、调试与团队约束取舍。</span></li><li><a href="/2026/07/29/embedded-can/">CAN 总线：仲裁、错误处理与可靠通信</a><span>理解优先级、错误状态和总线恢复。</span></li><li><a href="/2026/07/29/embedded-watchdog/">看门狗：让系统从不可恢复故障中自动重启</a><span>让健康监督而非盲目喂狗决定是否复位。</span></li></ol></section>

路径之外的资料入口见[精选阅读](/reading/)；需要按主题自由浏览时可回到[技术地图](/technology/)。
