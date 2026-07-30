---
title: 精选阅读
date: 2026-07-30 15:16:00
layout: page
---

<div class="page-lead">
  <p class="section-kicker">CURATED READING</p>
  <p>外部资料在这里以“来源、适用问题、自己的延伸笔记”组织。只保留短摘要和原文链接，不复制原文；读完后最好用一个小实验或一篇站内笔记把理解落下来。</p>
</div>

<div class="note-flow"><span>读原始资料</span><i>→</i><span>记录工程问题</span><i>→</i><span>做最小复现</span><i>→</i><span>写自己的结论</span><i>→</i><span>留下证据与链接</span></div>

<div class="resource-list"><article class="resource-item"><p class="section-kicker">LINUX KERNEL DOCS</p><h3><a href="https://docs.kernel.org/trace/osnoise-tracer.html" target="_blank" rel="noopener">osnoise tracer</a></h3><p>适合在实时任务出现尾延迟时，按 IRQ、softirq、调度、NMI/SMI 等方向收集可解释证据。</p><p class="resource-links"><a href="/2026/07/30/linux-osnoise-tracer/">站内延伸：osnoise tracer</a> · <a href="/2026/07/30/realtime-regression-baseline/">回归基线</a></p></article><article class="resource-item"><p class="section-kicker">ROS 2</p><h3><a href="https://github.com/ros2/ros2_tracing" target="_blank" rel="noopener">ros2_tracing</a></h3><p>用于理解 ROS 2 层面的追踪能力。它能提供观测信号，但系统归因仍需要与进程、调度和业务语义关联。</p><p class="resource-links"><a href="/projects/robotraceopt/">站内延伸：RoboTraceOpt</a> · <a href="/evidence/">证据日志</a></p></article><article class="resource-item"><p class="section-kicker">NVIDIA ISAAC</p><h3><a href="https://nvidia-isaac-ros.github.io/" target="_blank" rel="noopener">Isaac ROS Documentation</a></h3><p>适合在已有 ROS 2 管线后评估 GPU 加速、视觉、VSLAM 与硬件平台集成，而不是把 Isaac 当成一键解决机器人问题的总称。</p><p class="resource-links"><a href="/2026/07/30/isaac-ros-nitros-zero-copy/">NITROS 与少拷贝</a> · <a href="/2026/07/30/isaac-ros-vslam-nvblox/">VSLAM 与 nvblox</a></p></article><article class="resource-item"><p class="section-kicker">BUILD SYSTEM</p><h3><a href="https://cmake.org/cmake/help/latest/manual/cmake-toolchains.7.html" target="_blank" rel="noopener">CMake Toolchains Manual</a></h3><p>交叉编译的关键是用 toolchain file 固定目标视角：编译器、sysroot、查找路径和 try-compile 都不能误回到宿主机。</p><p class="resource-links"><a href="/2026/07/29/cmake-cross-compilation/">站内延伸：CMake 交叉编译</a> · <a href="https://buildroot.org/downloads/manual/manual.html" target="_blank" rel="noopener">Buildroot Manual</a></p></article><article class="resource-item"><p class="section-kicker">LINUX BPF</p><h3><a href="https://docs.kernel.org/bpf/" target="_blank" rel="noopener">Linux BPF Documentation</a></h3><p>适合了解 eBPF 的内核接口与限制。采集本身不会自动给出根因，时间、进程身份和工作负载拓扑仍必须对齐。</p><p class="resource-links"><a href="/projects/robotraceopt/">站内延伸：跨层证据图</a> · <a href="/2026/07/29/tcp-drop-tracing/">TCP 丢包追踪</a></p></article></div>

## 收录准则

<div class="note-map"><span><b>优先一手资料</b><small>官方文档、上游源码、标准、论文和真实项目仓库优先。</small></span><span><b>标明原文</b><small>每个外部观点保留可访问的原文链接与适用版本。</small></span><span><b>不整篇搬运</b><small>只写与当前工程问题有关的摘要和自己的解释。</small></span><span><b>给出边界</b><small>区分文档描述、仿真复现、台架观察和正式实验结论。</small></span><span><b>保留可操作性</b><small>优先能导向命令、代码、实验设计或排障动作的资料。</small></span><span><b>定期淘汰</b><small>失效链接、过时版本或无法核验的说法会被替换或标注。</small></span></div>
