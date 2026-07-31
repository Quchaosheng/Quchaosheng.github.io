---
title: 视觉伺服的端到端延迟预算：目标为什么总是慢半拍
date: 2026-08-04 09:30:00
allow_future: true
permalink: /2026/08/04/ai-robot-visual-servo-latency-budget/
categories: [技术, AI机器人]
tags: [视觉伺服, 延迟, ROS 2, Jetson]
---

机械臂对着一个静止目标来回摆，日志里相机明明有 30 Hz，推理也写着 20 ms。这样的系统很容易被误判成“模型不够准”。我会先问另一个问题：控制器用到的那张图，究竟是几毫秒以前拍的？

视觉伺服用的是一条链路，不是一个单独的推理时间。相机曝光、读出和传输，驱动排队，图像转换，推理，坐标变换，规划以及执行器命令，每一段都可能把结果推迟。只盯着网络或模型的平均耗时，通常看不到真正让末端抖起来的长尾。

<div class="note-flow"><span>给图像和命令打时间戳</span><i>→</i><span>拆开采集到执行的各段耗时</span><i>→</i><span>测量 P50 与 P99</span><i>→</i><span>把结果年龄接入控制截止期</span><i>→</i><span>超时则降速或拒绝</span></div>

<figure class="note-visual"><figcaption><span>延迟预算图</span>闭环判断应该使用同一时钟和同一批数据，不能把不同时间基准的平均值拼在一起。</figcaption><div class="note-map"><span><b>曝光和读出</b><small>图像的时间起点可能是曝光开始、中点或帧完成，设备定义必须写进记录。</small></span><span><b>队列等待</b><small>多帧排队会让平均 FPS 看起来正常，但结果年龄不断变大。</small></span><span><b>推理</b><small>动态形状、显存回收和算子选择会把偶发耗时拉长。</small></span><span><b>TF 查询</b><small>变换时间点不匹配时，数值正确的位姿也可能已经过期。</small></span><span><b>控制周期</b><small>控制器要知道结果还能使用多久，不能只检查消息是否到达。</small></span><span><b>降级路径</b><small>过期、缺帧或置信度不足时要有减速、重采样和安全停止。</small></span></div></figure>

## 先把“延迟”定义清楚

设图像曝光中点是 `t_capture`，推理结果发布时刻是 `t_result`，控制命令真正交给驱动的时刻是 `t_cmd`。对控制器来说，更有用的量是结果年龄：

```text
age_at_command = t_cmd - t_capture
T_loop = T_capture + T_transport + T_decode + T_infer + T_tf + T_control
```

这里的 `T_capture` 不是固定常数。Rolling Shutter 还会带来行间时间差，具体实验见[快门、曝光与运动模糊](/2026/08/05/ai-robot-rolling-shutter-motion-blur/)。`T_infer` 也不能拿一次 `time` 的结果代表，至少要保留 P50、P95 和 P99。若推理线程偶尔因为显存分配、CPU 抢占或输入队列等待多花 40 ms，机械臂看到的就不是当前目标。

我会在消息里保留两个时间：传感器的采样时间和节点收到消息的本机时间。前者用于几何变换，后者用于发现传输和排队。两者只留一个，后面很难分辨是相机慢还是执行器在等。

## ROS 2 里先看年龄，不要只看频率

下面几条命令能把最初的现象记录下来。它们不能直接给出完整闭环延迟，却能确认输入是否已经在入口处变旧。

```bash
ros2 topic hz /camera/image_raw
ros2 topic echo --once /camera/image_raw/header
ros2 topic echo --once /detections
ros2 run tf2_ros tf2_monitor base_link camera_link
ros2 bag record /camera/image_raw /detections /tf /tf_static
```

把 `header.stamp`、节点接收时间、检测发布时间和控制发送时间写到同一份 CSV。不要在不同节点里各自使用系统墙上时间再事后相减，NTP 调整或容器时钟偏移会制造负延迟。ROS 2 的时钟设计允许使用系统时间、稳态时间或仿真时间，录包和回放时尤其要确认 `use_sim_time` 的状态。

## 队列长度经常是罪魁祸首

相机 30 Hz、推理平均 20 ms，看起来应该没有问题。若推理偶尔耗时 50 ms，深度队列设成 10，系统会优先处理旧帧，控制器得到的结果可能落后几百毫秒。对闭环来说，丢掉旧帧通常比排队更好。

一个简单的接收策略是记录队列长度和消息年龄，超过截止期就丢弃：

```text
on_detection(msg, now):
    age = now - msg.source_stamp
    if age > control_deadline:
        reject("stale_detection")
        return
    controller.update(msg)
```

这段是接口示意，不是某个 ROS 2 包的现成 API。实际实现还要处理时钟类型、TF 查询失败和消息序号。重要的是让“过期结果被拒绝”成为可观测事件，而不是静默覆盖。

## 把时间拆开测，才知道该改哪里

我会先固定机器人和目标，测静态基线，再让底盘以可重复速度移动。每次只改变一个变量，记录以下字段：

| 字段 | 作用 | 失败时先看什么 |
| --- | --- | --- |
| `source_stamp` | 传感器采样时间 | 驱动是否填了 0 或传输完成时间 |
| `receive_time` | 节点拿到消息的时间 | DDS 队列和线程调度 |
| `inference_done` | 推理结束时间 | 动态形状、显存和 CPU 抢占 |
| `tf_lookup_time` | 变换使用的时间点 | TF 缓存不足或外推 |
| `command_time` | 命令发出时间 | 控制器周期和执行器接口 |

如果只有 `inference_done` 到 `command_time` 变长，应该查线程调度和锁；如果 `source_stamp` 到 `receive_time` 已经很长，换模型不会解决问题。若所有时间都稳定，但末端仍然偏，才轮到检查标定、Rolling Shutter 和运动模型。

线程调度可沿着[ROS 2 Executor 回调时间线](/2026/02/17/ros2-executor-callback-groups-basics/)继续查，坐标变换问题则看[TF2 的查询时间与缓存](/2026/05/21/ros2-tf2-frame-time-basics/)。GPU 内部的复制与同步应单独用[CUDA Stream 实验](/2026/06/22/cuda-memory-stream-basics/)测量。

## 预算不是越紧越好

控制截止期应由目标速度、工作距离和允许的空间误差反推。一个粗略检查是：

```text
position_error_from_age ≈ target_speed * age_at_command
```

它忽略了相机投影、机械臂雅可比和控制器动态，只适合做数量级筛查。真正的验收要把末端误差、跟踪丢失、降速次数和急停次数一起记录。不能为了让 P99 好看而偷偷降低帧率，也不能把拒绝结果算成成功控制。

当预算不够时，常见的工程选择有三种：丢弃旧帧、降低机器人速度、减少处理链路中的复制和转换。把 TensorRT 改成 FP16 可能降低推理时间，但它不会修复错误的时间戳和过期 TF。每个改动都应有前后两份相同格式的记录。

## 参考资料

- [ROS 2 Clock and Time Design](https://design.ros2.org/articles/clock_and_time.html)
- [ROS 2 QoS settings](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html)
- [ROS 2 tf2 time travel](https://docs.ros.org/en/jazzy/Tutorials/Intermediate/Tf2/Time-Travel-With-Tf2-Cpp.html)
- [NVIDIA Isaac ROS](https://nvidia-isaac-ros.github.io/)

**证据边界：**文中的公式用于建立排查量，不代表某个机械臂、相机或 Jetson 平台的实测上限。没有给出抓取成功率、P99 数值或硬件同步效果。发布前应使用目标设备的录包、时间戳定义和控制日志补齐这些证据。
