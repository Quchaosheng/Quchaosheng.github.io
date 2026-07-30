---
title: AprilTag Docking Demo
date: 2026-07-30 16:04:00
layout: page
description: 将 AprilTag 观测、置信门、Guard 和 Nav2 Docking 串成可复现的 Gazebo 停靠流程。
cover: /image/projects/apriltag-docking.png
---

<div class="page-lead"><p class="section-kicker">项目说明</p><p>AprilTag Docking Demo 在 Gazebo 中让 TurtleBot3 靠近充电桩。连续看到 AprilTag 后，任务才会交给 Nav2 Docking 做最后接近；低置信、多 Tag、位姿跳变、Guard 失效和取消都会走明确的处理分支。</p></div>

<figure class="project-hero-image"><img src="/image/projects/apriltag-docking.png" alt="Gazebo 中的 AprilTag 视觉停靠演示"></figure>

<div class="project-facts"><div><span>仿真平台</span><strong>Gazebo Harmonic · TurtleBot3 Waffle Pi</strong></div><div><span>ROS 2</span><strong>Jazzy · apriltag_ros · Nav2 Docking</strong></div><div><span>关键门限</span><strong>三帧确认 · Tag loss · pose jump · Guard</strong></div></div>

## 任务怎么开始

<div class="note-flow"><span>Gazebo RGB<br>camera</span><i>→</i><span>apriltag_ros<br>detection + TF</span><i>→</i><span>Tag pose bridge<br>置信与去抖</span><i>→</i><span>Guard + task bridge</span><i>→</i><span>Nav2 Docking<br>DockRobot Action</span></div>

项目复用 `opennav_docking::SimpleChargingDock`。自定义部分负责 Tag 到 dock type 的映射、观测门限、状态桥接和诊断。只有确认过的 `PoseStamped` 才会进入 Docking。

## 哪些观测会被拒绝

<div class="note-map"><span><b>低置信 / Hamming</b><small>decision margin 不够或 Hamming distance 非零时，忽略这次观测。</small></span><span><b>未知 / 多 Tag</b><small>ID 没映射或同时出现多个 Tag 时，不给停靠目标。</small></span><span><b>三帧确认</b><small>连续三帧通过后才发布，避免偶然识别改变任务状态。</small></span><span><b>位姿跳变</b><small>平移或 yaw 超过门限时重新确认，防止错误 TF 混进来。</small></span><span><b>Tag 丢失</b><small>接受的样本超时会报告出来，由 Nav2 按 stale-pose 和 retry 处理。</small></span><span><b>Guard</b><small>缺失、过期或 false Guard 会阻止新目标，也能取消正在执行的 DockRobot。</small></span></div>

## 先跑一次

```bash
source /opt/ros/jazzy/setup.bash
colcon build --symlink-install
source install/setup.bash
ros2 launch demo2_apriltag_docking demo.launch.py headless:=true rviz:=false
ros2 service call /demo2/start_docking std_srvs/srv/Trigger "{}"
```

需要 Guard 时，以 transient-local 方式发布 `/guard/docking_allowed`。随后检查 `/demo2/tag_state`、`/demo2/docking_state` 和 `/diagnostics`。

## 这只是仿真

- 可以复现 staging、Tag 确认、Guard、DockRobot、取消、状态诊断和多种拒绝路径。
- `SimpleChargingDock` 用距离行为表示停靠成功，不表示真实充电接触。
- 没有包括物理接点、电池电流、底盘制动、传感器噪声、动态障碍物和生产级安全认证。

上真机前，先分别测相机内外参、地面摩擦、停靠误差、传感器失效和独立安全停止。

**链接：** [GitHub 源码、视频与测试](https://github.com/Quchaosheng/ros2-apriltag-docking-demo) · [证据日志](/evidence/)
