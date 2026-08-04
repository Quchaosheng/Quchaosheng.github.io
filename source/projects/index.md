---
title: 项目
date: 2026-07-29 16:00:00
layout: page
---

## 项目说明

这里列出五个公开项目的简短 About 文案。每个项目页都会写清主线、证据环境和未验证范围；`vcan`、Gazebo 和 QEMU 只能说明软件或仿真路径跑通，不能代替真机测试。

### RoboTraceOpt

- **About：** 把 ROS 2 应用、中间件与内核事件按可比身份和受控时间窗口归属成证据图；证据不足时拒绝下诊断结论。
- **证据：** RuntimeEvent、ROS 2 tracing、eBPF/CAN 适配、关联和配对验证流程。
- **边界：** 仓库当前以 Ubuntu 22.04 / ROS 2 Humble 和开发检查为主，不把它写成通用 24.04 / Jazzy 路径。
- [看项目说明](/projects/robotraceopt/) · [源码与运行步骤](https://github.com/Quchaosheng/RoboTraceOpt)

### Embodied Agent Runtime

- **About：** 受任务契约约束的 ROS 2 运行时；规则、模型输入和视觉触发器只能申请固定工作流，不能直接发送 CAN 命令。
- **证据：** X5/Humble、UVC ArUco、双 CANable 通信和受限 Provider 集成。
- **边界：** 未验证真实电机运动、硬件急停、DDS 安全或闭环机器人控制。
- [看项目说明](/projects/embodied-agent-runtime/) · [源码与演示](https://github.com/Quchaosheng/embodied-agent-runtime)

### ros2_control vcan Motor Demo

- **About：** ROS 2 Humble 差速驱动的软件链路，把 `cmd_vel` 经 `ros2_control` 和 SocketCAN 送到双虚拟电机。
- **证据：** ACK、反馈超时、watchdog、错误注入、原始 CAN 检查和软件 safe-stop。
- **边界：** vcan/虚拟电机不模拟真实电机负载、电气 CAN、ECU HIL 或硬件急停。
- [看项目说明](/projects/ros2-control-vcan/) · [源码与演示](https://github.com/Quchaosheng/ros2-control-vcan-motor-demo)

### AprilTag Docking Demo

- **About：** Jazzy/Gazebo 中的 AprilTag 感知到停靠软件链路；自定义映射、观测门限和 Guard，复用 Nav2 `SimpleChargingDock` 完成最后接近。
- **证据：** 低置信、多 Tag、连续有效观测、位姿跳变、取消和状态诊断路径。
- **边界：** 不声明真实相机、底盘、充电接点或生产级自主停靠；不把诊断消息去重写成检测帧去重。
- [看项目说明](/projects/apriltag-docking/) · [源码与演示](https://github.com/Quchaosheng/ros2-apriltag-docking-demo)

### Quard Star RISC-V64

- **About：** 基于 rCore-Tutorial 设计的 C 语言 RISC-V64 SMP 重实现；OpenSBI domain 策略连接七个普通 hart、一个 FreeRTOS trusted hart 和 VirtIO/TAP。
- **证据：** QEMU 中的 DTS 权限声明、固件输出和双向访问异常探针共同验证预期边界。
- **边界：** 第一方工作是 domain 策略与验证；真实芯片、DMA、物理时序和性能结论仍未验证。
- [看项目说明](/projects/quard-star-riscv64/) · [源码与测试记录](https://github.com/Quchaosheng/quard-star-riscv64-net)
