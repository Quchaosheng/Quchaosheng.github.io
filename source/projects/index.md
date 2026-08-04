---
title: 项目
date: 2026-07-29 16:00:00
layout: page
---

## 项目说明

这里放的是可以直接看代码和运行说明的项目。每个项目页都会写清它做什么、在哪个环境跑过，以及哪些结论还不能下。`vcan`、Gazebo 和 QEMU 只能说明软件或仿真路径跑通，不能代替真机测试。

### RoboTraceOpt

- 用来把 ROS 2 事件、调度 trace 和 CAN ACK 放在一起排查超时和抖动。
- 仓库已有 RuntimeEvent 插桩、trace 关联、诊断和配置尝试的代码。
- WSL、RuntimeEvent-only 和 vcan 只用于开发检查；调度器问题和 X5 上的结论还要在原生环境测。
- [看项目说明](/projects/robotraceopt/) · [源码与运行步骤](https://github.com/Quchaosheng/RoboTraceOpt)

### Embodied Agent Runtime

- 模型或视觉模块只能提交允许的工作流，不能直接发 CAN 帧。
- 已跑过 X5/Humble、UVC ArUco、双 CANable 和受限 Provider 的链路。
- 还没有拿它验证电机运动、硬件急停或闭环控制。
- [看项目说明](/projects/embodied-agent-runtime/) · [源码与演示](https://github.com/Quchaosheng/embodied-agent-runtime)

### ros2_control vcan Motor Demo

- 把 `cmd_vel` 经过 `ros2_control` 和 SocketCAN 送到两只虚拟电机。
- 可以复现 ACK、反馈、watchdog、bus-off、超时和 safe-stop。
- 没有模拟真实电机负载和电气 CAN。
- [看项目说明](/projects/ros2-control-vcan/) · [源码与演示](https://github.com/Quchaosheng/ros2-control-vcan-motor-demo)

### AprilTag Docking Demo

- 在 Gazebo 中把 AprilTag 观测、Guard 和 Nav2 Docking 接起来。
- 已测试任务触发、取消和 Tag 状态处理。
- 这不是一套真机自主停靠验证。
- [看项目说明](/projects/apriltag-docking/) · [源码与演示](https://github.com/Quchaosheng/ros2-apriltag-docking-demo)

### Quard Star RISC-V64

- 用 OpenSBI 启动七个普通内核 hart 和一个独立 FreeRTOS hart。
- 在 QEMU/TAP 中测试了 VirtIO、FatFs、TCP/IP 和 PMP 隔离。
- 隔离和性能结论目前只适用于 QEMU 模型。
- [看项目说明](/projects/quard-star-riscv64/) · [源码与测试记录](https://github.com/Quchaosheng/quard-star-riscv64-net)
