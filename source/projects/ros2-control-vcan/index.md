---
title: ros2_control vcan Motor Demo
date: 2026-07-30 16:02:00
layout: page
description: 基于 SocketCAN 与双虚拟电机的 ros2_control 差速驱动、安全停止和故障注入演示。
cover: /image/projects/vcan-diffbot.png
---

<div class="page-lead"><p class="section-kicker">项目说明</p><p>这是一个 ROS 2 Humble 差速驱动演示。`ros2_control` 通过 SocketCAN 管两只虚拟电机，能查看命令、编码器反馈、ACK、watchdog、故障注入和安全停止。</p></div>

<figure class="project-hero-image"><img src="/image/projects/vcan-diffbot.png" alt="ros2_control vcan 差速驱动和 CAN 安全遥测演示"></figure>

<div class="project-facts"><div><span>目标环境</span><strong>Ubuntu 22.04 · ROS 2 Humble · C++17</strong></div><div><span>控制链</span><strong>cmd_vel · ros2_control · SocketCAN · vcan</strong></div><div><span>安全动作</span><strong>ACK / feedback timeout · disabled zero command</strong></div></div>

## 命令怎么到虚拟电机

<div class="note-flow"><span>速度指令<br>cmd_vel</span><i>→</i><span>diff_drive_controller</span><i>→</i><span>CanMotorHardware<br>SystemInterface</span><i>→</i><span>SocketCAN<br>vcan0</span><i>→</i><span>双虚拟电机<br>ACK + encoder</span></div>

两端直接使用 `ros2_socketcan` 的 C++ 收发 API。命令带 sequence、enable 位和 watchdog 时间；虚拟电机会检查 ACK 和反馈是否超时，异常时发送零速度并停用。

## 代码里做的检查

<div class="note-map"><span><b>SystemInterface</b><small>把 ros2_control 的命令和状态映射成 CAN 命令与编码器反馈。</small></span><span><b>ACK 检查</b><small>只接受 sequence 对得上的 ACK；缺失或异常 ACK 会报错。</small></span><span><b>双电机</b><small>任一侧反馈丢失，两侧都会进入安全停止。</small></span><span><b>watchdog</b><small>命令失联时，虚拟电机会自己停下。</small></span><span><b>故障注入</b><small>可以复现丢帧、延迟、畸形帧和 CAN error frame。</small></span><span><b>诊断</b><small>总线状态、ACK 队列、反馈年龄和停止原因会发到 diagnostics。</small></span></div>

## 先跑一次

```bash
source /opt/ros/humble/setup.bash
colcon build --packages-select vcan_diffbot_demo
source install/setup.bash
bash src/vcan_diffbot_demo/scripts/setup_vcan.sh
ros2 launch vcan_diffbot_demo demo.launch.py
```

另开终端发布速度命令，同时看控制器、`/joint_states`、`/diagnostics` 和 `candump -L vcan0`。故障时，两侧都应变成 disabled zero command。

## 这能说明什么

- virtual motor、vcan、ACK、反馈、watchdog、bus-off、取消和 safe-stop 的软件路径可以复现。
- 可以改用 `can0` 并关闭 virtual motor，但真实控制器必须实现同一套 ID 与字节布局。
- vcan 不能说明电气总线、真实电机负载、执行器惯性、供电问题或硬件急停。

接真实 CAN 前，先分别检查线缆、终端电阻、bitrate、控制器协议和无负载安全动作，再谈运动能力。

**链接：** [GitHub 源码与演示](https://github.com/Quchaosheng/ros2-control-vcan-motor-demo) · [证据日志](/evidence/)
