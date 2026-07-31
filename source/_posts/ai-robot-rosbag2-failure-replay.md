---
title: rosbag2 故障回放：怎样把一次机器人超时变成可重复实验
date: 2026-08-24 09:30:00
allow_future: true
permalink: /2026/08/24/ai-robot-rosbag2-failure-replay/
categories: [技术, AI机器人]
tags: [rosbag2, ROS 2, 故障回放, tracing]
---

机器人在现场偶尔导航超时，回到实验室却怎么也复现不了。开发者通常会加几条日志，再跑一次任务。等真正需要分析时才发现，录包里没有相机时间戳、TF、诊断状态或控制命令，留下的只有一行“action timeout”。

rosbag2 能保存一次运行中的消息，但它不会自动让实验变得确定。要复现故障，必须提前定义录哪些话题、使用哪种 QoS、回放时是否使用仿真时间，以及哪些硬件输入需要替换成回放数据。回放的目标是重建当时的输入和状态，不是把视频重新播放一遍。

<div class="note-flow"><span>定义故障假设和截止期</span><i>→</i><span>按时间与 QoS 录制闭环输入</span><i>→</i><span>检查包内容和版本指纹</span><i>→</i><span>用仿真时间回放并对齐日志</span><i>→</i><span>逐步改变一个变量验证根因</span></div>

<figure class="note-visual"><figcaption><span>回放证据图</span>一次可用的故障包要同时包含输入、变换、命令、状态和运行环境指纹。</figcaption><div class="note-map"><span><b>传感器输入</b><small>图像、深度、IMU、里程计和采样时间是故障上下文。</small></span><span><b>TF 与时钟</b><small>缺少坐标变换或时钟信息，回放会出现“数据不存在”的假故障。</small></span><span><b>任务状态</b><small>Action feedback、取消请求和结果码用来还原状态机走到了哪一步。</small></span><span><b>控制命令</b><small>速度、轨迹和执行器反馈能区分规划慢与驱动未响应。</small></span><span><b>系统诊断</b><small>CPU、GPU、温度、节点重启和错误码记录资源与故障边界。</small></span><span><b>版本指纹</b><small>包、参数、容器和硬件信息保证回放条件可以被说明。</small></span></div></figure>

## 先写出你要证明的假设

“导航超时”不是一个根因。可能是感知结果过期，TF 查询外推失败，规划器没有路径，控制命令被 watchdog 丢弃，也可能是 CPU 被录包和推理抢走。录包前先写一个可检验的假设，例如“超时前 200 ms 内，局部地图没有更新”或“Action 已取消，但控制器仍在执行上一段轨迹”。

假设决定需要哪些话题。视觉问题要有原始图像和检测结果，控制问题要有命令、反馈和安全状态，调度问题还要配 tracing 或系统指标。所有东西都录下来会迅速耗尽磁盘，也会带来隐私风险。

## 录包命令只是起点

可以先用命令行建立一个最小包：

```bash
ros2 bag record \
  /camera/image_raw /camera/camera_info \
  /tf /tf_static /odom /cmd_vel \
  /diagnostics /robot_state
ros2 bag info <bag_directory>
```

实际话题要按系统替换。录制前检查 QoS，尤其是传感器常用的 best-effort 配置。订阅端 QoS 不兼容时，包里可能没有数据，而命令本身不一定明显报错。对于大图像和点云，可先录压缩或低分辨率副本，但要记录这会改变什么证据。

QoS 兼容关系可以先用[发布订阅对照实验](/2026/04/30/ros2-qos-basics/)复现。涉及 `/tf` 时，还要按[TF2 的坐标系与时间查询](/2026/05/21/ros2-tf2-frame-time-basics/)确认静态变换、动态变换和查询时刻都在包里。

## 时间必须统一

回放时使用 `--clock`，并确认所有相关节点设置了 `use_sim_time`：

```bash
ros2 bag play <bag_directory> --clock
ros2 param get /planner use_sim_time
ros2 topic echo --once /clock
```

一个节点用墙上时间、另一个节点用仿真时间，回放出来的消息年龄就没有意义。录包中的时间戳也要区分传感器采样时间、节点接收时间和发布完成时间。只保留发布时刻，无法判断问题在传输还是计算。

## 回放时不要一次改很多东西

第一轮尽量原样回放，确认故障现象仍然出现。第二轮只替换一个变量，例如把真实相机替成固定图像、关闭录包、降低模型负载或使用不同的 TF。每轮都输出同样的指标：Action 完成时间、检测结果年龄、控制命令间隔、规划器状态和安全触发原因。

如果回放无法复现，也不代表原故障不存在。可能是硬件中断、温度、无线网络或未录制的外部输入没有被重建。此时要把“未能复现”和“已排除的变量”写进报告，而不是把回放结果当成真机结论。

## 把包和环境一起交付

一个可交接的故障包至少应包含：

| 项目 | 作用 |
| --- | --- |
| `ros2 bag info` 输出 | 说明话题、时间范围、存储格式和消息数量 |
| 参数与启动命令 | 还原节点配置和启动顺序 |
| Git commit/容器摘要 | 固定代码和依赖版本 |
| 设备与负载信息 | 说明 CPU、GPU、温度和功耗条件 |
| 期望现象 | 定义“复现成功”是什么 |
| 隐私和保留期限 | 限制图像、语音或人员信息的传播 |

回放系统还可以和 ROS 2 tracing、结构化日志结合，把一次超时还原成消息时间线。图像能告诉你目标在哪里，时间线才能告诉你为什么控制器没有及时收到它。

故障包交给测试或客户之前，可以按[验收报告的证据分层](/2026/08/25/ai-robot-acceptance-evidence/)再检查一遍：哪些结论来自回放，哪些来自台架，哪些已经有真机记录。回放复现成功也不能自动升级成真机安全结论。

## 参考资料

- [ROS 2 bag recording tutorial](https://docs.ros.org/en/jazzy/Tutorials/Advanced/Recording-A-Bag-From-Your-Own-Node-Py.html)
- [ROS 2 Clock and Time Design](https://design.ros2.org/articles/clock_and_time.html)
- [ROS 2 QoS settings](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html)
- [ROS 2 lifecycle nodes](https://design.ros2.org/articles/node_lifecycle.html)

**证据边界：**回放只能重建被录下来的输入和状态，不能自动重建硬件中断、温度、网络或未记录的外部因素。本文没有声称某次超时已经被复现；实际报告必须说明录包覆盖范围和剩余未知量。
