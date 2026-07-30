---
title: Jetson 机器人部署：功耗、算力与实时控制怎样分工
date: 2026-07-24 14:00:00
permalink: /2026/07/30/jetson-robot-deployment/
categories: [技术, AI机器人]
tags: [Jetson, JetPack, CUDA]
---

Jetson 把 ARM CPU、NVIDIA GPU、内存和多媒体加速器放在一块边缘板上。JetPack 提供 Linux for Tegra、CUDA、TensorRT、cuDNN 等组件，能让相机、视觉推理和 ROS 2 在机器人本体上运行。它适合做感知和任务处理，但 GPU 跑得快不代表电机控制回路的最长延迟就可预测。

<div class="note-flow"><span>选择 JetPack 与功耗模式</span><i>→</i><span>部署模型和 ROS 2 节点</span><i>→</i><span>测量 CPU/GPU/内存负载</span><i>→</i><span>分离推理与实时控制</span><i>→</i><span>在温度稳定后复测长尾</span></div>

<figure class="note-visual"><figcaption><span>资源图</span>Jetson 是感知和任务平台，实时控制与安全链路应有更确定的执行边界。</figcaption><div class="note-map"><span><b>相机与多媒体</b><small>采集、颜色转换、编码和解码会占用专用引擎与内存带宽。</small></span><span><b>GPU 推理</b><small>TensorRT、CUDA stream 和显存使用影响模型吞吐与尾延迟。</small></span><span><b>CPU 与 DDS</b><small>ROS 2 回调、序列化、规划和驱动仍会争抢 ARM CPU。</small></span><span><b>共享内存</b><small>多路相机和大模型常先受带宽与队列限制，而不是 GPU 算力。</small></span><span><b>MCU/RT 控制</b><small>电流、速度、限位和 watchdog 放在可预测、可独立失效的链路。</small></span><span><b>安全停止</b><small>急停和驱动抑制不依赖 GPU、ROS 2 或普通进程调度。</small></span></div></figure>

## Jetson 上实际要争抢哪些资源

推理不只占 GPU。摄像头采集和图像颜色转换可能使用 ISP 或 VIC，视频解码会使用专用引擎，TensorRT 占 GPU 和显存带宽，ROS 2 节点、DDS 和驱动则会占用 CPU。多路相机加上大模型时，瓶颈往往从 GPU 算力变成内存带宽、CPU 回调排队或散热引起的降频。

因此应同时观察以下维度，而不是只看 FPS：

- **模型侧**：每帧推理延迟、GPU 利用率、显存占用、输入队列长度。
- **系统侧**：CPU 核心利用率、RAM/Swap、温度、频率变化和磁盘 I/O。
- **机器人侧**：图像从采集到被控制器使用的年龄、丢帧率、控制指令间隔。

Jetson 系统通常可用下面的命令进行初步观测。实际字段会随型号和 JetPack 版本变化，但它们足以帮助你判断是“模型慢”还是“整机正在喘不过气”。

```bash
sudo nvpmodel -q          # 查看当前功耗/性能模式
tegrastats                # 连续观察 CPU、GPU、内存、温度与频率
sudo jetson_clocks --show # 查看可锁定的时钟状态
```

`jetson_clocks` 很适合做可重复的性能测试，但在产品上长期强制最高频率会带来功耗、温升和续航成本。正确顺序是先测清热稳定后的长尾，再决定是否改变功耗模式、风扇策略或模型规模。

## 一个更稳妥的职责划分

常见结构是 Jetson 运行相机、感知、地图、规划与 ROS 2 Action；一个 MCU、专用驱动器或独立实时线程负责编码器读取、电流环、速度环、限位与急停。两者之间只交换有限的、高层的命令和反馈，例如 `cmd_vel`、目标轨迹、状态字与故障码。

```text
Jetson: camera -> TensorRT -> perception -> planner -> bounded velocity command
MCU/RT controller: watchdog -> limit check -> motor loop -> encoder feedback
Safety path: emergency stop -> power/driver inhibit, independent of GPU process
```

不要让推理进程直接写 PWM，也不要把急停实现成一个普通 ROS topic。前者把不确定的 GPU 负载带进控制环，后者会在网络、进程或 DDS 出问题时失效。

## 部署前后的检查顺序

1. 固定 JetPack、CUDA、TensorRT 和模型版本，记录设备型号及功耗模式。
2. 先跑单相机、单模型的冷启动与热稳定测试，再逐个加入相机、规划和录包负载。
3. 用 `tegrastats` 与 ROS 2 时间戳一起记录，观察 P95/P99，而不是只看平均 FPS。
4. 施加内存压力、拔插相机、降低照度、制造模型超时，验证控制器是否按预期降级。

这些情况都跑过后，才知道这套 Jetson 配置在机器人上遇到压力时会怎样反应。

参考：[NVIDIA Jetson Documentation](https://docs.nvidia.com/jetson/) · [Jetson Linux Developer Guide](https://docs.nvidia.com/jetson/archives/)
