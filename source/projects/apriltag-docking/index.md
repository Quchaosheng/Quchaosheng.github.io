---
title: AprilTag Docking Demo
date: 2026-07-30 16:04:00
layout: page
description: 将 AprilTag 观测、置信门、Guard 和 Nav2 Docking 串成可复现的 Gazebo 停靠流程。
cover: /image/projects/apriltag-docking.png
---

<div class="page-lead"><p class="section-kicker">PROJECT DOSSIER</p><p>AprilTag Docking Demo 在 Gazebo 中驱动 TurtleBot3 到充电桩 staging pose，验证连续 AprilTag 观测后交给 Nav2 Docking 完成最后接近。重点不是“识别到了 Tag”，而是把低置信、多个 Tag、位姿跳变、Guard 失效和取消路径放进任务状态机。</p></div>

<figure class="project-hero-image"><img src="/image/projects/apriltag-docking.png" alt="Gazebo 中的 AprilTag 视觉停靠演示"></figure>

<div class="project-facts"><div><span>仿真平台</span><strong>Gazebo Harmonic · TurtleBot3 Waffle Pi</strong></div><div><span>ROS 2</span><strong>Jazzy · apriltag_ros · Nav2 Docking</strong></div><div><span>关键门限</span><strong>三帧确认 · Tag loss · pose jump · Guard</strong></div></div>

## 从视觉观测到 DockRobot

<div class="note-flow"><span>Gazebo RGB<br>camera</span><i>→</i><span>apriltag_ros<br>detection + TF</span><i>→</i><span>Tag pose bridge<br>置信与去抖</span><i>→</i><span>Guard + task bridge</span><i>→</i><span>Nav2 Docking<br>DockRobot Action</span></div>

项目复用 `opennav_docking::SimpleChargingDock`，自定义部分集中在 Tag 到 dock type 的映射、观测门限、状态桥接和诊断。只有经过确认的 `PoseStamped` 才能进入 Docking；不确定观测会保持可见，而不会被悄悄当作正确停靠目标。

## 拒绝与恢复策略

<div class="note-map"><span><b>低置信 / Hamming</b><small>decision margin 不足或 Hamming distance 非零时拒绝当前观测。</small></span><span><b>未知 / 多 Tag</b><small>未映射 ID 或同时出现多个 Tag 时不给出停靠目标。</small></span><span><b>三帧确认</b><small>连续样本通过后才发布，减少一次偶然检测改变任务状态。</small></span><span><b>位姿跳变</b><small>超过平移或 yaw 门限时重新确认，避免把错误 TF 当成视觉更新。</small></span><span><b>Tag loss</b><small>接受样本超时会显式报告；Nav2 按其 stale-pose 与 retry 逻辑处理。</small></span><span><b>Guard</b><small>缺失、过期或 false Guard 阻止新目标，并可取消正在执行的 DockRobot。</small></span></div>

## 最小可重复演示

```bash
source /opt/ros/jazzy/setup.bash
colcon build --symlink-install
source install/setup.bash
ros2 launch demo2_apriltag_docking demo.launch.py headless:=true rviz:=false
ros2 service call /demo2/start_docking std_srvs/srv/Trigger "{}"
```

需要 Guard 时，以 transient-local 方式发布 `/guard/docking_allowed`；随后检查 `/demo2/tag_state`、`/demo2/docking_state` 和 `/diagnostics`，而不是只看 Gazebo 中的一次成功动画。

## 证据边界

- **可复现仿真：** staging、Tag 确认、Guard、DockRobot、取消、状态诊断和多种拒绝路径。
- **已模拟的结果：** `SimpleChargingDock` 使用距离行为表达停靠成功；它不等同于真实充电接触。
- **未包含：** 物理接点、电池电流、底盘制动、传感器噪声、动态障碍物和生产级安全认证。

从仿真走向实体前，应分别验证相机内外参、地面摩擦、停靠误差、传感器失效和独立安全停止，再把它们汇总成真实机器人停靠结论。

**入口：** [GitHub 源码、视频与测试](https://github.com/Quchaosheng/ros2-apriltag-docking-demo) · [证据日志](/evidence/) · [实验记录模板](/evidence/template/)
