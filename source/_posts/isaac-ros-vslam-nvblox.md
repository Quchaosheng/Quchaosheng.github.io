---
title: Isaac ROS Visual SLAM 与 nvblox：机器人怎样定位并理解空间
date: 2026-07-30 09:45:00
categories: [技术, AI机器人]
tags: [Visual SLAM, nvblox, Isaac ROS]
---

Visual SLAM 融合相机与惯性信息估计机器人的运动轨迹，nvblox 则把深度观测融合成适合导航的三维占据和距离信息。二者连接后，可以把“我在哪里”和“周围哪里能走”持续送给规划模块。
<div class="note-flow"><span>同步相机与 IMU</span><i>→</i><span>Visual SLAM 估计位姿</span><i>→</i><span>深度数据按位姿融合</span><i>→</i><span>生成三维地图/距离场</span><i>→</i><span>导航规划并反馈新观测</span></div>

系统质量取决于时间同步、外参、纹理、曝光和运动速度。定位漂移与地图误差会一起传到规划层，因此必须记录传感器时间戳、轨迹和地图版本，分层定位问题。参考：[Isaac ROS Visual SLAM](https://nvidia-isaac-ros.github.io/repositories_and_packages/isaac_ros_visual_slam/index.html) · [Isaac ROS nvblox](https://nvidia-isaac-ros.github.io/repositories_and_packages/isaac_ros_nvblox/index.html)
