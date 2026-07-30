---
title: Projects
date: 2026-07-29 16:00:00
layout: page
---

## 项目证据说明

这些项目按实际验证环境展示。`vcan`、Gazebo 和 QEMU 是可复现的软件或虚拟硬件证据，不等于物理执行器验证。

### RoboTraceOpt

- **主线：** RuntimeEvent v2 → ROS 2 tracing / eBPF / SocketCAN 适配 → 类型化证据图 → 可审计诊断 → 受约束的配置优化
- **已有实现：** 三类 ROS 2 工作负载插桩、拓扑约束的 trace-stage 关联、冲突与不确定性处理、候选方案验证和离线回滚决策
- **证据边界：** WSL、RuntimeEvent-only 与 vcan 是开发或代理证据；正式调度器归因和 X5 结论仍需合格的原生 Linux 或 X5 实测会话
- [源码、运行说明与预检流程](https://github.com/Quchaosheng/RoboTraceOpt)

### Embodied Agent Runtime

- **主线：** AI 输入 → 严格任务契约 → ROS 2 Action → SocketCAN
- **已验证：** X5/Humble、UVC ArUco、双 CANable 通信、受限真实 Provider 集成
- **未验证：** 电机运动、硬件急停、闭环机器人控制
- [源码与演示](https://github.com/Quchaosheng/embodied-agent-runtime)

### ros2_control vcan Motor Demo

- **主线：** `cmd_vel` → `ros2_control` → SocketCAN → 双虚拟电机
- **已验证：** ACK、feedback、watchdog、bus-off、超时与 safe-stop
- **边界：** 不模拟真实电机负载和电气 CAN
- [源码与演示](https://github.com/Quchaosheng/ros2-control-vcan-motor-demo)

### AprilTag Docking Demo

- **主线：** AprilTag 观测 → Guard → Nav2 Docking
- **已验证：** Gazebo 仿真、任务触发、取消与 Tag 状态策略
- **边界：** 未声明真实机器人自主停靠
- [源码与演示](https://github.com/Quchaosheng/ros2-apriltag-docking-demo)

### Quard Star RISC-V64

- **主线：** OpenSBI → 七核 SMP C 内核 + 独立 FreeRTOS hart
- **已验证：** QEMU/TAP、VirtIO、FatFs、TCP/IP、PMP 双向隔离
- **边界：** 隔离和性能数据仅适用于 QEMU 模型
- [源码与证据回放](https://github.com/Quchaosheng/quard-star-riscv64-net)
