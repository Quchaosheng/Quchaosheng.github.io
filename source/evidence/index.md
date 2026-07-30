---
title: 证据日志
date: 2026-07-30 15:12:00
layout: page
---

<div class="page-lead">
  <p class="section-kicker">验证记录</p>
  <p>这页只写已经做过的测试。每一行都说明测试环境、这次能说明什么，以及还没有测什么。</p>
</div>

<div class="evidence-legend"><span class="status-badge status-implementation">实现公开</span><span class="status-badge status-proxy">仿真 / 代理</span><span class="status-badge status-physical">实体 I/O</span><span class="status-badge status-pending">正式会话待补</span></div>

## 怎么看这张表

代码、Gazebo、vcan、QEMU、实体 I/O 和正式测试回答的问题不同。只有截图或口头描述时，先把它当作线索；要判断结果是否可靠，还要看运行环境、命令、负载和原始日志。

## 当前项目台账

<div class="evidence-table-wrap"><table class="evidence-table"><thead><tr><th>项目</th><th>当前证据</th><th>可说明的范围</th><th>下一步</th></tr></thead><tbody><tr><td><a href="/projects/robotraceopt/">RoboTraceOpt</a></td><td><span class="status-badge status-implementation">实现公开</span><br><span class="status-badge status-proxy">开发 / 预检</span></td><td>RuntimeEvent、ROS 2 tracing、eBPF、CAN/vcan 适配与诊断/优化流程已有公开实现；WSL、dry-run、vcan 不构成正式测量结论。</td><td>在原生 Linux 或 X5 运行冻结矩阵，保存能力报告与 artifact manifest。</td></tr><tr><td><a href="/projects/embodied-agent-runtime/">Embodied Agent Runtime</a></td><td><span class="status-badge status-physical">X5 实体 I/O</span></td><td>X5、UVC、ArUco 与双 CANable 台架的任务链路；不外推为电机负载、硬件急停或完整闭环控制验证。</td><td>独立设计执行器、安全链路和闭环控制测试。</td></tr><tr><td><a href="/projects/ros2-control-vcan/">ros2_control vcan Motor Demo</a></td><td><span class="status-badge status-proxy">vcan 软件闭环</span></td><td>ACK、反馈、watchdog、bus-off、超时与 safe-stop 的软件路径。</td><td>如需声明真实电机能力，补充电气总线与负载条件下的独立测试。</td></tr><tr><td><a href="/projects/apriltag-docking/">AprilTag Docking Demo</a></td><td><span class="status-badge status-proxy">Gazebo 仿真</span></td><td>视觉观测、Guard、Nav2 Docking 与取消路径的可复现仿真。</td><td>真实传感器、定位误差、底盘制动和安全空间需单列验收。</td></tr><tr><td><a href="/projects/quard-star-riscv64/">Quard Star RISC-V64</a></td><td><span class="status-badge status-proxy">QEMU / TAP</span></td><td>七核 SMP、FreeRTOS hart、VirtIO、TCP/IP、存储与 PMP 隔离的虚拟平台验证。</td><td>硬件差异、时序和性能数据必须在目标板上重新测量。</td></tr></tbody></table></div>

有新的测试时会更新这张表。没有对应日志、trace 或测试记录的项目，不会写成“已验证”。
