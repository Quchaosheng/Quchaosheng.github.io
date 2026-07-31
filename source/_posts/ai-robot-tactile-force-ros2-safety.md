---
title: 触觉与力传感器接入 ROS 2：时间戳、滤波和安全阈值怎么落到控制器
date: 2026-08-06 09:30:00
allow_future: true
permalink: /2026/08/06/ai-robot-tactile-force-ros2-safety/
categories: [技术, AI机器人]
tags: [触觉, 力传感器, ROS 2, 安全控制]
---

机械臂夹住一个物体后，力传感器的曲线偶尔会突然归零，下一周期又跳回去。另一个常见现象是：传感器显示力已经超过阈值，夹爪却没有停。排查时不要先把锅甩给滤波器。消息是否带了正确时间，读数是否排队，阈值触发是否走了独立的安全通道，这些问题更常见。

触觉和力信号有两个用途。一个是给策略或模型提供“接触发生了”的观测，允许稍微延迟；另一个是保护人和设备，必须在可预期的时间内触发。把两者共用一个 ROS 2 话题和同一套队列，后面很难证明急停真的可靠。

<div class="note-flow"><span>确认传感器时间戳和单位</span><i>→</i><span>记录原始数据与消息年龄</span><i>→</i><span>做零点和滤波基线</span><i>→</i><span>分别设计控制阈值与急停通道</span><i>→</i><span>注入断线、过期和饱和故障</span></div>

<figure class="note-visual"><figcaption><span>接触链路图</span>模型可以等待处理后的力值，安全路径必须能识别过期和缺失数据。</figcaption><div class="note-map"><span><b>原始采样</b><small>记录单位、量程、采样率和传感器内部滤波，不能只看显示值。</small></span><span><b>时间戳</b><small>优先保留传感器采样时间，同时记录 ROS 节点收到消息的时间。</small></span><span><b>滤波器</b><small>滤波降低噪声，也会引入相位延迟；参数要和控制周期一起验收。</small></span><span><b>接触判断</b><small>阈值应区分上升沿、持续时间和恢复条件，避免单点毛刺触发。</small></span><span><b>安全通道</b><small>断线、过期、超量程和自检失败都应能让控制器进入安全状态。</small></span><span><b>回放证据</b><small>用 rosbag2 保存原始信号、命令和状态，故障后才能重现当时的判断。</small></span></div></figure>

## 先搞清楚消息里的数值是什么

ROS 2 常见的力消息是 `geometry_msgs/msg/WrenchStamped`，包含力和力矩以及一个 `Header`。`Header.stamp` 的含义要由驱动说明确定。它可能是采样时刻，也可能是驱动把数据交给 ROS 的时刻。两者差别在低速演示里不明显，在快速接触时会直接影响阈值触发。

先把接口和实际话题检查一遍：

```bash
ros2 interface show geometry_msgs/msg/WrenchStamped
ros2 topic info /wrench --verbose
ros2 topic hz /wrench
ros2 topic echo --once /wrench
```

还要确认力的坐标系和单位。一个以工具坐标系发布的 `force.x`，不能直接和基座坐标系里的阈值比较。传感器的满量程、零点漂移、安装预紧力和是否经过厂商滤波，都应该写入驱动参数或实验记录。只在 RViz 里看箭头，无法证明数值的物理意义。

## 滤波器会帮忙，也会让动作迟到

移动平均很容易写，却会把最近几次采样混在一起。若窗口是 `N`，采样周期是 `Ts`，仅从窗口就可能增加接近 `(N - 1) * Ts / 2` 的平均延迟。低通滤波还会产生相位延迟，截止频率越低，曲线越平滑，接触事件越晚。

接触判断可以把上升沿和持续时间分开：

```text
if sample_age > max_age or sensor_status != OK:
    enter_safe_stop("invalid_force_sample")
elif abs(force_filtered) > contact_threshold:
    contact_timer += control_period
    if contact_timer >= required_duration:
        request_compliant_motion()
else:
    contact_timer = 0
```

这是控制逻辑的示意，不是某个控制器包的可直接编译代码。`max_age`、`contact_threshold` 和 `required_duration` 必须由目标速度、传感器噪声和机构惯量共同确定。安全停止还要有独立的硬件或驱动层实现，不能只依赖一个 Python 订阅回调。

## 两条路径，两种验收标准

给策略网络的触觉观测可以容忍少量缺帧，甚至可以在时间窗口里做特征堆叠。给安全逻辑的信号则需要明确的超时、断线和恢复规则。实际系统可以保留一条原始话题和一条处理后话题，安全监控订阅原始状态或驱动层的硬件故障标志。

建议做一个小的故障矩阵：

| 故障 | 控制观测 | 安全动作 | 需要留存的证据 |
| --- | --- | --- | --- |
| 消息过期 | 拒绝本次接触判断 | 减速或停机 | `source_stamp`、检测时间 |
| 传感器断线 | 不更新策略输入 | 进入安全状态 | 驱动错误码、断线时刻 |
| 数值饱和 | 标记为无效 | 停止施力 | 原始值、量程和状态位 |
| 零点漂移 | 触发重新标定提示 | 限制动作 | 空载基线和温度 |
| 单点毛刺 | 不改变接触状态 | 不直接急停 | 原始与滤波曲线 |

表里的动作不是通用配置。比如夹爪和协作机械臂的安全要求不同，必须结合风险分析和驱动器说明书验收。

## 让故障可以被回放

触觉问题很适合用 `rosbag2` 做回放。记录原始力、滤波后的力、控制命令、关节状态、诊断状态以及系统时钟：

```bash
ros2 bag record /wrench /wrench_filtered /joint_states /cmd_vel /diagnostics
ros2 bag info <bag_directory>
ros2 bag play <bag_directory> --clock
```

回放时要确认节点使用仿真时间，并把“这次结果为什么被拒绝”作为一条结构化日志写下来。只有曲线没有判定原因，过几天仍然只能靠猜。

完整的录制范围、仿真时钟和逐变量回放方法见[rosbag2 故障回放](/2026/08/24/ai-robot-rosbag2-failure-replay/)。力阈值事件需要和关节状态、命令以及驱动错误码使用同一个事件 ID。

## 阈值要和动作后果绑定

“超过 10 N 就停”看起来很明确，实际上还缺少方向、持续时间、当前速度和接触对象。拉力、扭矩和法向力的含义不同；同一个阈值在慢速贴合和高速碰撞中也不等价。更稳妥的接口会同时输出测量值、年龄、有效标志和触发原因，控制器只消费这个完整状态。

最终验收应覆盖空载、正常接触、传感器拔插、时间戳冻结、消息延迟、量程饱和和电源重启。没有做过这些故障注入，就不能把“仿真里能停”写成真机安全结论。

若安全监控依赖 Linux 周期线程，还要用[周期控制循环的 deadline miss](/2026/02/27/linux-periodic-control-loop-basics/)验证唤醒和工作时间。ROS 2 消息按时到达，不代表底层监控线程一定按期运行。

## 参考资料

- [ROS 2 WrenchStamped message](https://docs.ros.org/en/jazzy/p/geometry_msgs/msg/WrenchStamped.html)
- [ROS 2 sensor_msgs/JointState](https://docs.ros.org/en/jazzy/p/sensor_msgs/msg/JointState.html)
- [ROS 2 Clock and Time Design](https://design.ros2.org/articles/clock_and_time.html)
- [rosbag2 recording and playback](https://docs.ros.org/en/jazzy/Tutorials/Advanced/Recording-A-Bag-From-Your-Own-Node-Py.html)
- [ROS 2 diagnostics](https://docs.ros.org/en/jazzy/p/diagnostic_msgs/)

**证据边界：**文中的滤波延迟关系和故障矩阵用于设计与排查，不是某款力传感器的安全认证。本文没有给出具体阈值、急停时间或碰撞力结果。真机发布前必须补上目标传感器量程、驱动状态位、控制周期和硬件安全链路。
