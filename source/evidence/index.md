---
title: 证据日志
date: 2026-07-30 15:12:00
layout: page
---

<div class="page-lead">
  <p class="section-kicker">EVIDENCE LOG</p>
  <p>这里记录项目在什么环境下验证过什么，也记录尚未验证什么。代码、仿真、虚拟总线、实体 I/O 和正式测试不是同一种证据，不能相互替代。</p>
</div>

<div class="evidence-legend"><span class="status-badge status-implementation">实现公开</span><span class="status-badge status-proxy">仿真 / 代理</span><span class="status-badge status-physical">实体 I/O</span><span class="status-badge status-pending">正式会话待补</span></div>

## 记录方法

<div class="note-flow"><span>固定环境与版本</span><i>→</i><span>记录命令与输入</span><i>→</i><span>保存原始工件</span><i>→</i><span>标明能证明什么</span><i>→</i><span>保留失败与边界</span></div>

一次“跑通”不是结论。能复查的记录至少包含平台、软件版本、负载、原始输出、通过阈值和失败时的现场信息；若只有截图或口头描述，就只能把它当作线索，而不是验收证据。

## 当前项目台账

<div class="evidence-table-wrap"><table class="evidence-table"><thead><tr><th>项目</th><th>当前证据</th><th>可说明的范围</th><th>下一步</th></tr></thead><tbody><tr><td><a href="/projects/robotraceopt/">RoboTraceOpt</a></td><td><span class="status-badge status-implementation">实现公开</span><br><span class="status-badge status-proxy">开发 / 预检</span></td><td>RuntimeEvent、ROS 2 tracing、eBPF、CAN/vcan 适配与诊断/优化流程已有公开实现；WSL、dry-run、vcan 不构成正式测量结论。</td><td>在原生 Linux 或 X5 运行冻结矩阵，保存能力报告与 artifact manifest。</td></tr><tr><td><a href="/projects/embodied-agent-runtime/">Embodied Agent Runtime</a></td><td><span class="status-badge status-physical">X5 实体 I/O</span></td><td>X5、UVC、ArUco 与双 CANable 台架的任务链路；不外推为电机负载、硬件急停或完整闭环控制验证。</td><td>独立设计执行器、安全链路和闭环控制测试。</td></tr><tr><td><a href="/projects/ros2-control-vcan/">ros2_control vcan Motor Demo</a></td><td><span class="status-badge status-proxy">vcan 软件闭环</span></td><td>ACK、反馈、watchdog、bus-off、超时与 safe-stop 的软件路径。</td><td>如需声明真实电机能力，补充电气总线与负载条件下的独立测试。</td></tr><tr><td><a href="/projects/apriltag-docking/">AprilTag Docking Demo</a></td><td><span class="status-badge status-proxy">Gazebo 仿真</span></td><td>视觉观测、Guard、Nav2 Docking 与取消路径的可复现仿真。</td><td>真实传感器、定位误差、底盘制动和安全空间需单列验收。</td></tr><tr><td><a href="/projects/quard-star-riscv64/">Quard Star RISC-V64</a></td><td><span class="status-badge status-proxy">QEMU / TAP</span></td><td>七核 SMP、FreeRTOS hart、VirtIO、TCP/IP、存储与 PMP 隔离的虚拟平台验证。</td><td>硬件差异、时序和性能数据必须在目标板上重新测量。</td></tr></tbody></table></div>

## 新增记录的最小模板

<div class="note-map"><span><b>问题与阈值</b><small>测什么、允许多大抖动/错误、失败后如何处置。</small></span><span><b>环境快照</b><small>硬件、内核、固件、启动参数、工具和提交版本。</small></span><span><b>负载与命令</b><small>输入、时长、并发、seed、运行命令和输出目录。</small></span><span><b>原始工件</b><small>trace、日志、直方图、包、截图及其哈希或来源。</small></span><span><b>结论范围</b><small>本次能说明什么，哪些条件变化后不再成立。</small></span><span><b>后续动作</b><small>补测、回归、修复、回滚或明确暂不验证的原因。</small></span></div>

记录会随着实际实验更新；没有相应工件的项目不会用“已验证”替代“看起来合理”。[实验记录模板](/evidence/template/)可以作为每一次新实验的起点。
