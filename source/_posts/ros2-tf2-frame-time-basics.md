---
title: ROS 2 TF2 入门：坐标系、时间戳和变换查询怎么配合
date: 2026-05-21 09:30:00
permalink: /2026/05/21/ros2-tf2-frame-time-basics/
categories: [技术, AI机器人]
tags: [ROS 2, TF2, 坐标系, 时间戳, 标定]
---

相机识别出的目标位置看起来没问题，转换到 `base_link` 后却跳动，或者 TF2 直接报 extrapolation error。多数时候矩阵本身没错，查询时刻才是问题。TF2 保存的是随时间变化的坐标树，帧名和时间戳缺一个都不完整。

<div class="note-flow"><span>定义父子坐标系</span><i>→</i><span>发布静态或动态变换</span><i>→</i><span>保留传感器采样时间</span><i>→</i><span>按该时间查询 TF</span><i>→</i><span>处理过期与外推失败</span></div>

<figure class="note-visual"><figcaption><span>TF2 时间树</span>坐标树说明“相对谁”，时间戳说明“什么时候”。</figcaption><div class="note-map"><span><b>map</b><small>全局一致坐标，可在重定位后相对 odom 修正。</small></span><span><b>odom</b><small>短时间连续但允许漂移，适合局部控制。</small></span><span><b>base_link</b><small>机器人机体参考坐标，传感器和执行器从这里挂接。</small></span><span><b>sensor frame</b><small>相机或雷达坐标，外参应由安装和标定确定。</small></span><span><b>static TF</b><small>固定安装关系，通常发布一次并缓存。</small></span><span><b>dynamic TF</b><small>随里程计或关节变化，查询必须落在缓存时间范围内。</small></span></div></figure>

## 先把坐标树画出来

```bash
ros2 run tf2_tools view_frames
ros2 run tf2_ros tf2_echo base_link camera_link
ros2 run tf2_ros tf2_monitor base_link camera_link
```

`view_frames` 用来检查树是否连通、有无重复父节点。`tf2_echo` 查看当前数值，`tf2_monitor` 更适合观察延迟和发布频率。树必须是清晰的父子关系，不能让同一个 frame 同时被两个来源发布。

## 静态变换和动态变换别混用

相机固定在机身上时，`base_link -> camera_link` 通常是静态外参。底盘在世界中的位置 `odom -> base_link` 会随运动更新，是动态变换。关节机械臂的 link 关系也随 joint state 变化。

静态变换示例：

```bash
ros2 run tf2_ros static_transform_publisher \
  --x 0.20 --y 0.00 --z 0.35 \
  --roll 0 --pitch 0 --yaw 0 \
  --frame-id base_link --child-frame-id camera_link
```

数值只是命令格式示例，不能当作真实相机外参。实际值应来自机械尺寸和标定。

## 查询要使用传感器采样时间

图像在 `t_capture` 采集，机器人随后继续移动。若检测结束后用 `now()` 查询 TF，会把旧图像里的目标放到新姿态上。更合理的是用图像 `header.stamp` 查询对应时刻的变换。

```text
target_in_base = lookup_transform(
    target="base_link",
    source="camera_link",
    time=image.header.stamp)
```

这是接口语义示意。具体 C++/Python API 还要设置 timeout，并处理变换暂时不可用。

## Extrapolation error 在说什么

请求时间早于 TF 缓存最早记录，叫向过去外推；请求时间晚于最新记录，叫向未来外推。常见原因包括传感器和主机时钟不同步、驱动填错时间戳、TF 发布太慢、回放时没有使用 `/clock`，或者消息在队列里积压太久。

先记录四个时间：传感器采样、节点收到消息、TF 最新时间、控制器消费时间。只看错误字符串，很难区分时钟问题和排队问题。

## frame_id 也属于接口契约

同一个位置数值，在 `camera_link`、`base_link` 和 `map` 下含义不同。消息必须填写正确 `frame_id`，单位和轴方向也要一致。相机光学坐标常有自己的轴约定，不能凭名字猜。

当 TF 过期或不连通时，控制器应拒绝该结果、重新采样或降速。返回单位矩阵继续运行，会把坐标错误隐藏成后续规划问题。

## 常见故障怎样分开看

| 现象 | 先检查 | 常见根因 |
| --- | --- | --- |
| `frame does not exist` | `view_frames`、frame 拼写 | 节点未启动、命名不一致 |
| past extrapolation | 消息时间与缓存起点 | 队列积压、回放跳转、缓存太短 |
| future extrapolation | 传感器与主机时钟 | 硬件时钟偏移、错误使用 `now()` |
| 数值稳定但位置偏 | 静态外参和轴方向 | 标定错误、光学坐标约定不一致 |
| 快速运动时抖动 | TF 频率、图像年龄 | 发布太慢、时间戳含义错误 |

排查时先确认树是否连通，再确认查询时间是否存在，最后才看数值和标定。三个问题混在一起调参数，会让错误暂时消失却无法复现。

## 从坐标基础走到视觉控制

TF2 只负责保存和查询坐标关系，不判断视觉结果是否足够新。理解本篇后，可以继续看[Rolling Shutter 与运动模糊](/2026/08/05/ai-robot-rolling-shutter-motion-blur/)和[视觉伺服延迟预算](/2026/08/04/ai-robot-visual-servo-latency-budget/)，把相机采样、TF 查询和控制截止期连成一条时间线。

## 参考资料

- [ROS 2 tf2 concepts](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Tf2.html)
- [Introduction to tf2](https://docs.ros.org/en/jazzy/Tutorials/Intermediate/Tf2/Introduction-To-Tf2.html)
- [REP 105 Coordinate Frames](https://www.ros.org/reps/rep-0105.html)
- [ROS 2 Clock and Time Design](https://design.ros2.org/articles/clock_and_time.html)

**证据边界：**命令中的静态变换数值仅用于演示参数格式。TF 树、外参、缓存长度和时钟同步必须在目标机器人上验证。
