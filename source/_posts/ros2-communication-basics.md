---
title: ROS 2 通信入门：Topic、Service、Action 和 Parameter 怎么选
date: 2026-03-31 09:30:00
permalink: /2026/03/31/ros2-communication-basics/
categories: [技术, AI机器人]
tags: [ROS 2, Topic, Service, Action, Parameter]
---

相机图像用 Service 请求，机器人移动命令用 Topic 发一次，任务执行却没有反馈，这些接口都能“跑起来”，后面却很难处理超时、取消和节点重启。ROS 2 的四类常用通信方式解决的是不同问题，先按数据语义选择，代码会简单很多。

<div class="note-flow"><span>判断数据是流还是请求</span><i>→</i><span>确定是否需要反馈与取消</span><i>→</i><span>选择 Topic、Service 或 Action</span><i>→</i><span>配置 QoS 和超时</span><i>→</i><span>用 CLI 验证接口</span></div>

<figure class="note-visual"><figcaption><span>通信选择图</span>接口类型由交互语义决定，不由消息大小或写代码的方便程度决定。</figcaption><div class="note-map"><span><b>Topic</b><small>连续状态和事件流，发布者通常不等待每个订阅者确认业务结果。</small></span><span><b>Service</b><small>短时请求响应，调用者等待一个结果，不适合长时间动作。</small></span><span><b>Action</b><small>长任务，提供目标、反馈、结果和取消语义。</small></span><span><b>Parameter</b><small>节点配置与运行参数，不是高频传感器通道。</small></span><span><b>QoS</b><small>决定 Topic 的可靠性、历史深度和数据寿命等传输语义。</small></span><span><b>状态机</b><small>通信成功不等于业务完成，任务状态仍需明确建模。</small></span></div></figure>

## 先用 CLI 看一套正在运行的系统

```bash
ros2 node list
ros2 topic list -t
ros2 service list -t
ros2 action list -t
ros2 param list
```

进一步检查单个节点：

```bash
ros2 node info /robot_controller
ros2 interface show geometry_msgs/msg/Twist
```

CLI 只能告诉你接口是否存在和类型是什么。是否过期、谁拥有状态、失败后怎样恢复，还要看消息字段、QoS 和任务设计。

## Topic 适合连续数据

相机、IMU、里程计、诊断和速度命令通常用 Topic。发布者把消息送进 DDS，订阅者按自己的节奏接收。Topic 不天然提供“执行完成”，收到 `/cmd_vel` 也不代表底盘已经达到速度。

周期状态应带时间戳和有效标志。控制器还要设置 watchdog：一段时间没收到新命令就减速或停车，而不是永远执行最后一条消息。

```bash
ros2 topic info /cmd_vel --verbose
ros2 topic hz /odom
ros2 topic echo --once /odom
```

## Service 适合短请求

Service 有明确的 request 和 response，适合读取一次状态、触发短操作或修改配置。服务回调如果需要几十秒，客户端很难知道进度，也不容易取消；这种任务应改用 Action。

```bash
ros2 service type /reset_odometry
ros2 service call /reset_odometry std_srvs/srv/Trigger '{}'
```

服务成功返回只说明服务器处理了请求。设备是否真的复位、外部动作是否完成，仍应通过响应字段或状态 Topic 验证。

## Action 为长任务保留反馈和取消

导航、抓取和轨迹执行可能持续数秒甚至更久。Action 把一次任务拆成 goal、feedback、result 和 cancel。客户端可以看到进度，也可以请求取消。

```bash
ros2 action info /navigate_to_pose
ros2 action send_goal /fibonacci example_interfaces/action/Fibonacci '{order: 10}' --feedback
```

取消请求不等于设备已经停止。Action 服务器要把取消传到底层控制器，并在安全状态确认后返回最终结果。

## Parameter 是配置，不是消息队列

Parameter 适合阈值、模式和静态配置。高频变化的目标位置或传感器数据不应靠反复改参数传输。参数更新还要验证范围和组合一致性，避免只改一半配置。

```bash
ros2 param get /controller max_speed
ros2 param set /controller max_speed 0.3
ros2 param dump /controller
```

## 一个简单选择表

| 需求 | 推荐接口 | 仍要补充 |
| --- | --- | --- |
| 连续传感器数据 | Topic | 时间戳、QoS、过期策略 |
| 一次快速查询 | Service | 超时、错误码、幂等性 |
| 导航或抓取任务 | Action | 反馈、取消、安全停止 |
| 节点配置 | Parameter | schema、范围、版本迁移 |

确定接口类型以后，Topic 还要继续选择[可靠性、队列深度和 durability](/2026/04/30/ros2-qos-basics/)。长任务如果需要把“请求取消”落实到“设备已经停下”，可以对照[VLA 任务执行状态机](/2026/08/13/ai-robot-vla-human-intervention-state-machine/)里的 `CancelRequested`、`Canceling` 和 `Canceled` 三个状态。

## 参考资料

- [ROS 2 Nodes](https://docs.ros.org/en/jazzy/Concepts/Basic/About-Nodes.html)
- [ROS 2 Topics](https://docs.ros.org/en/jazzy/Concepts/Basic/About-Topics.html)
- [ROS 2 Services](https://docs.ros.org/en/jazzy/Concepts/Basic/About-Services.html)
- [ROS 2 Actions](https://docs.ros.org/en/jazzy/Concepts/Basic/About-Actions.html)
- [ROS 2 Parameters](https://docs.ros.org/en/jazzy/Concepts/Basic/About-Parameters.html)

**证据边界：**接口选择表是通用设计建议，不代表某个机器人包的唯一实现。命令名称和接口类型要以目标 ROS 2 系统为准。
