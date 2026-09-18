---
title: ROS 2 时钟与 use_sim_time：回放正常但时间戳混乱的常见原因
date: 2026-09-16 09:30:00
permalink: /2026/09/16/ros2-clock-sim-time-consistency/
categories: [技术, ROS 2]
tags: [时钟, use_sim_time, 仿真时间, 回放]
---

使用 rosbag2 回放数据时，图像、检测结果和 TF 都出现了，但查询坐标变换时提示数据不存在，或者延迟算出来是负数。这类问题通常不是消息缺失，而是节点之间对“现在几点”的理解不一致。

ROS 2 中的时间不是单一的。系统时间、稳态时间和仿真时间可以同时存在，节点通过参数选择使用哪一个。这篇文章讨论它们各自的语义，以及为什么混用会产生看起来矛盾的结果。

<div class="note-flow"><span>确定时间来源</span><i>→</i><span>逐节点设置 use_sim_time</span><i>→</i><span>回放时广播 /clock</span><i>→</i><span>消息时间戳随仿真时间</span><i>→</i><span>查询使用同一时钟</span><i>→</i><span>核对时间戳与延迟</span></div>

<figure class="note-visual"><figcaption><span>三种时间</span>它们都能推进，但起点、可调整性和适用场景不同。</figcaption><div class="note-map"><span><b>系统时间</b><small>墙上时间，可能被 NTP 调整，会发生跳变。</small></span><span><b>稳态时间</b><small>单调推进，适合测时间间隔，不表示真实时刻。</small></span><span><b>仿真时间</b><small>由 /clock 驱动，回放和仿真中使用。</small></span><span><b>use_sim_time</b><small>逐节点参数，必须一致设置才有效。</small></span><span><b>/clock</b><small>提供仿真时间的入口，回放时需要显式播放。</small></span><span><b>时间戳</b><small>消息携带的时刻，其含义取决于发布方的时钟选择。</small></span></div></figure>

## 三种时间不能互相替代

系统时间表示真实世界时刻，会随对时调整。用它计算两个事件之间的间隔时，如果中间发生了对时跳变，差值可能异常甚至为负。

稳态时间单调递增，适合测量时长，但它不代表任何真实时刻，跨机器比较没有意义。

仿真时间由 `/clock` 话题驱动，只在有发布者时推进。回放或仿真场景下用它，可以让整条链路基于录包里的时间运行。

一个常见误解是“设置 `use_sim_time` 之后一切都会自动对齐”。实际这个参数是逐节点的，每个参与节点都要设置，而且订阅它的节点需要收到 `/clock` 才会推进。

## 先确认每个节点当前用的是哪个时钟

```bash
ros2 param get /planner use_sim_time
ros2 param get /controller use_sim_time
ros2 topic echo --once /clock
ros2 topic hz /clock
```

第一、二条确认节点设置是否一致。第三条确认 `/clock` 确实在发布，第四条确认它在推进而不是停在一个值上。

如果只设置了部分节点，混合状态会表现出典型症状：使用仿真时间的节点认为时间是回放进度，使用系统时间的节点认为时间是当前时刻，两者计算出的消息年龄差异巨大。

## 回放时的正确顺序

先启动时钟发布，再启动消费节点，最后开始回放数据。顺序反了会出现节点在启动阶段拿不到时间而报错。

```bash
# 1. 使用仿真时间启动节点
ros2 launch my_robot demo.launch.py use_sim_time:=true

# 2. 回放并广播时钟
ros2 bag play my_bag --clock

# 3. 确认时间已经推进
ros2 topic echo --once /clock
```

`--clock` 是关键，没有它包里会缺少时钟来源，`use_sim_time` 为真的节点会停在时间零点或等待。

## 时间戳的含义要按发布方判断

同一条消息里的 `header.stamp`，含义取决于发布者怎么填。它可能是传感器采样时刻、数据完成时刻或发布时刻，这三者对延迟计算的影响不同。

计算端到端延迟时，需要明确两端使用的是同一时钟，并且时间戳对应同一个物理事件。如果起点是采样时刻、终点是系统时间，那么结论只在没有时钟跳变且两个时钟同源时成立。

一个稳妥的做法是同时记录时间戳和接收时刻，并在日志里标注时钟来源。事后发现异常时，可以判断问题是数据本身延迟大，还是时钟口径不一致。

## 排查顺序建议

先确认 `/clock` 是否存在并推进；再确认所有相关节点 `use_sim_time` 一致；然后确认消息时间戳在推进；最后才计算延迟指标。

跳过前两步直接看延迟数字，很容易把时钟口径问题当成性能问题，从而去优化一个并不存在的瓶颈。

## 参考资料

- [ROS 2 时钟概念说明](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Clock.html)
- [理解仿真时间教程](https://docs.ros.org/en/jazzy/Tutorials/Intermediate/Time/Understanding-Sim-Time.html)
- [ROS 2 时间设计文档](https://design.ros2.org/articles/clock_and_time.html)

## 证据边界

本文讨论时钟语义与配置一致性，不包含任何具体系统的回放性能数据。文中的命令用于确认当前状态；“时间一致”是延迟结论成立的前提，但即使时间一致，延迟数值仍取决于负载与环境，需要单独测量。
