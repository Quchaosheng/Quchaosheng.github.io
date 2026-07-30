---
title: 精选阅读
date: 2026-07-30 15:16:00
layout: page
---

<div class="page-lead">
  <p class="section-kicker">外部资料</p>
  <p>这里放官方文档、上游项目和对应的站内笔记。每条只留一句说明和原文链接，方便知道该从哪里开始。</p>
</div>

<p>读完一篇资料后，最好在自己的环境里跑一个小例子，再把遇到的问题记下来。只收藏链接，通常很快就会忘记它为什么有用。</p>

<div class="resource-list"><article class="resource-item"><p class="section-kicker">LINUX KERNEL DOCS</p><h3><a href="https://docs.kernel.org/trace/osnoise-tracer.html" target="_blank" rel="noopener">osnoise tracer</a></h3><p>实时任务出现尾延迟时，用它检查 IRQ、softirq、调度、NMI/SMI 等干扰。</p><p class="resource-links"><a href="/2026/07/30/linux-osnoise-tracer/">站内延伸：osnoise tracer</a> · <a href="/2026/07/30/realtime-regression-baseline/">回归基线</a></p></article><article class="resource-item"><p class="section-kicker">ROS 2</p><h3><a href="https://github.com/ros2/ros2_tracing" target="_blank" rel="noopener">ros2_tracing</a></h3><p>用来采集 ROS 2 的 trace。要找根因，还得把它和进程、调度、业务事件对起来。</p><p class="resource-links"><a href="/projects/robotraceopt/">站内延伸：RoboTraceOpt</a> · <a href="/evidence/">证据日志</a></p></article><article class="resource-item"><p class="section-kicker">NVIDIA ISAAC</p><h3><a href="https://nvidia-isaac-ros.github.io/" target="_blank" rel="noopener">Isaac ROS Documentation</a></h3><p>已有 ROS 2 管线后，可以从这里看 GPU 加速、视觉、VSLAM 和平台集成。</p><p class="resource-links"><a href="/2026/07/30/isaac-ros-nitros-zero-copy/">NITROS 与少拷贝</a> · <a href="/2026/07/30/isaac-ros-vslam-nvblox/">VSLAM 与 nvblox</a></p></article><article class="resource-item"><p class="section-kicker">BUILD SYSTEM</p><h3><a href="https://cmake.org/cmake/help/latest/manual/cmake-toolchains.7.html" target="_blank" rel="noopener">CMake Toolchains Manual</a></h3><p>交叉编译时，用 toolchain file 固定编译器、sysroot、查找路径和 try-compile 的行为。</p><p class="resource-links"><a href="/2026/07/29/cmake-cross-compilation/">站内延伸：CMake 交叉编译</a> · <a href="https://buildroot.org/downloads/manual/manual.html" target="_blank" rel="noopener">Buildroot Manual</a></p></article><article class="resource-item"><p class="section-kicker">LINUX BPF</p><h3><a href="https://docs.kernel.org/bpf/" target="_blank" rel="noopener">Linux BPF Documentation</a></h3><p>这里讲 eBPF 的内核接口和限制。采集到数据后，还要把时间、进程身份和工作负载对齐。</p><p class="resource-links"><a href="/projects/robotraceopt/">站内延伸：跨层证据图</a> · <a href="/2026/07/29/tcp-drop-tracing/">TCP 丢包追踪</a></p></article></div>

## 收录原则

- 优先放官方文档、上游源码、标准、论文和真实项目仓库。
- 只摘和当前问题有关的内容，不整篇复制原文。
- 链接失效、版本过旧或说法无法核对时，会删除或标注。
