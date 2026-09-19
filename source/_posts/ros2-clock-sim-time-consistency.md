---
title: ROS 2 时钟与 use_sim_time：回放正常但时间戳混乱的常见原因
date: 2026-09-16 09:30:00
permalink: /2026/09/16/ros2-clock-sim-time-consistency/
categories: [技术， ROS 2]
tags: [时钟， use_sim_time， 仿真时间， 回放]
---

回放录包时，图像、检测结果、TF 都出来了，查询变换却提示数据不存在，算出来的延迟还是负数。第一次碰到这种情况我花了大半天才反应过来:不是数据缺了，是几个节点对“现在几点”的理解不一样。

ROS 2 里的时间不是单一的。系统时间、稳态时间、仿真时间可以同时存在，节点通过参数选一个。

<div class="note-flow"><span>确定时间来源</span><i>→</i><span>逐节点设 use_sim_time</span><i>→</i><span>回放时广播 /clock</span><i>→</i><span>消息时间戳跟随仿真时间</span><i>→</i><span>查询用同一时钟</span><i>→</i><span>核对时间戳与延迟</span></div>

<figure class="note-visual"><figcaption><span>三种时间</span>都能推进，但起点、能不能被调整、适用场景都不一样。</figcaption><div class="note-map"><span><b>系统时间</b><small>墙上时间，可能被对时调整，会跳变。</small></span><span><b>稳态时间</b><small>单调推进，适合测间隔，不代表真实时刻。</small></span><span><b>仿真时间</b><small>由 /clock 驱动，回放和仿真用。</small></span><span><b>use_sim_time</b><small>逐节点参数，要一致设置才有效。</small></span><span><b>/clock</b><small>仿真时间的入口，回放时要显式播。</small></span><span><b>时间戳</b><small>含义取决于发布方选的是哪个时钟。</small></span></div></figure>

## 三种时间不能互相替

系统时间表示真实时刻，跟着对时走。拿它算两个事件的间隔，中间要是发生了对时跳变，差值可能异常甚至为负。

稳态时间单调递增，适合测时长，但它不代表任何真实时刻，跨机器比没有意义。

仿真时间由 `/clock` 驱动，只有存在发布者时才推进。回放和仿真场景用它，能让整条链路基于录包里的时间跑。

一个常见误解是“设了 `use_sim_time` 就自动对齐了”。实际上它是逐节点的，参与的每个节点都要设，而且订阅方得收到 `/clock` 才会推进。

## 先看每个节点现在用哪个时钟

```bash
ros2 param get /planner use_sim_time
ros2 param get /controller use_sim_time
ros2 topic echo --once /clock
ros2 topic hz /clock
```

前两条看设置是否一致，第三条确认 `/clock` 确实在发，第四条确认它在推进而不是卡在一个值上。

只设了一部分节点时，症状很典型:用仿真时间的节点认为现在是回放进度，用系统时间的认为就是当前时刻，两边算出来的消息年龄差得离谱。

## 回放的启动顺序

先起时钟发布，再起消费节点，最后开始回放。反过来的话，节点在启动阶段拿不到时间会报错。

```bash
# 1. 用仿真时间启动节点
ros2 launch my_robot demo.launch.py use_sim_time:=true

# 2. 回放并广播时钟
ros2 bag play my_bag --clock

# 3. 确认时间已经在走
ros2 topic echo --once /clock
```

`--clock` 是关键。没有它包里就没有时钟来源，`use_sim_time` 为真的节点会停在时间零点或者一直等。

## 时间戳的含义得按发布方判断

同一条消息里的 `header.stamp`，含义取决于发布者怎么填。可能是传感器采样时刻、数据完成时刻，也可能是发布时刻，这三个对延迟计算的影响完全不同。

算端到端延迟时，要明确两端用的是不是同一个时钟，以及时间戳对应的是不是同一个物理事件。起点是采样时刻、终点是系统时间的话，结论只在没有时钟跳变且两者同源时才成立。

稳妥一点的做法是同时记时间戳和接收时刻，并在日志里标出时钟来源。事后发现异常时，能分清是数据本身慢，还是口径不一致。

## 排查顺序

先确认 `/clock` 存在且在推进;再确认相关节点 `use_sim_time` 一致;然后确认消息时间戳在推进;最后才算延迟指标。

跳过前两步直接看延迟数字，很容易把时钟口径问题当成性能问题，然后去优化一个根本不存在的瓶颈。

## 参考资料

- [ROS 2 时钟概念说明](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Clock.html)
- [理解仿真时间教程](https://docs.ros.org/en/jazzy/Tutorials/Intermediate/Time/Understanding-Sim-Time.html)
- [ROS 2 时间设计文档](https://design.ros2.org/articles/clock_and_time.html)

**证据边界：**本文不含任何系统的回放性能数据。上面的命令用来确认当前状态。“时间一致”是延迟结论成立的前提，但即便一致，具体数值仍然取决于负载和环境，得单独测。
