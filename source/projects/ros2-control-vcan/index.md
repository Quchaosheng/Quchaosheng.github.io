---
title: ros2_control vcan Motor Demo
date: 2026-07-30 16:02:00
layout: page
description: 基于 SocketCAN 与双虚拟电机的 ros2_control 差速驱动、安全停止和故障注入演示。
cover: /image/projects/vcan-diffbot.png
---

<div class="page-lead"><p class="section-kicker">PROJECT DOSSIER</p><p>这是一个 ROS 2 Humble 差速驱动演示：`ros2_control` 硬件接口通过 SocketCAN 管理两只虚拟电机，覆盖命令、编码器反馈、ACK、watchdog、故障注入和 safe-stop，而不是只展示一条正常的 `cmd_vel` 路径。</p></div>

<figure class="project-hero-image"><img src="/image/projects/vcan-diffbot.png" alt="ros2_control vcan 差速驱动和 CAN 安全遥测演示"></figure>

<div class="project-facts"><div><span>目标环境</span><strong>Ubuntu 22.04 · ROS 2 Humble · C++17</strong></div><div><span>控制链</span><strong>cmd_vel · ros2_control · SocketCAN · vcan</strong></div><div><span>安全动作</span><strong>ACK / feedback timeout · disabled zero command</strong></div></div>

## 一条完整的虚拟驱动路径

<div class="note-flow"><span>速度指令<br>cmd_vel</span><i>→</i><span>diff_drive_controller</span><i>→</i><span>CanMotorHardware<br>SystemInterface</span><i>→</i><span>SocketCAN<br>vcan0</span><i>→</i><span>双虚拟电机<br>ACK + encoder</span></div>

两个端点直接使用 `ros2_socketcan` 的 C++ 收发 API，不用 ROS topic 伪装 CAN 总线。命令会带 sequence、enable 位和 watchdog 时间；硬件侧持续检查 ACK 与反馈年龄，异常时走同一条安全停止路径。

## 关键机制

<div class="note-map"><span><b>SystemInterface</b><small>将 ros2_control 的 command/state interface 映射到 CAN 命令和编码器反馈。</small></span><span><b>ACK 跟踪</b><small>只接受匹配 sequence 的 ACK；拒绝、意外或缺失 ACK 会触发故障。</small></span><span><b>双电机一致性</b><small>任一侧反馈丢失都使整条驱动链进入 safe-stop，而非继续单轮运行。</small></span><span><b>电机 watchdog</b><small>命令帧携带 watchdog 周期，虚拟电机在命令失联时自行停下。</small></span><span><b>故障注入</b><small>丢帧、延迟、畸形帧和 CAN error frame 可按确定性规则复现。</small></span><span><b>诊断</b><small>总线状态、ACK 队列、反馈年龄和停止原因发布在 diagnostics 中。</small></span></div>

## 最小可重复演示

```bash
source /opt/ros/humble/setup.bash
colcon build --packages-select vcan_diffbot_demo
source install/setup.bash
bash src/vcan_diffbot_demo/scripts/setup_vcan.sh
ros2 launch vcan_diffbot_demo demo.launch.py
```

另开终端发布速度命令，并同时查看控制器、`/joint_states`、`/diagnostics` 和 `candump -L vcan0`。检查的重点不是“轮子看起来在动”，而是异常条件下两侧是否都变为 disabled zero command。

## 证据边界

- **可复现的软件证据：** virtual motor、vcan、ACK、反馈、watchdog、bus-off、取消和 safe-stop 的控制/协议路径。
- **物理 CAN 接口：** 可以改用 `can0` 并关闭 virtual motor，但真实控制器必须实现同一套 ID 与字节布局。
- **不能外推：** vcan 不提供电气总线、实际电机负载、执行器惯性、供电问题或硬件急停的证据。

任何接入真实 CAN 的后续实验都应先分开验证线缆、终端电阻、bitrate、控制器协议和无负载安全动作，再讨论运动能力。

**入口：** [GitHub 源码与演示](https://github.com/Quchaosheng/ros2-control-vcan-motor-demo) · [证据日志](/evidence/) · [实验记录模板](/evidence/template/)
