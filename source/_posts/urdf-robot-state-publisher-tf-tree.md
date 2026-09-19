---
title: robot_state_publisher 与 URDF：TF 树错了，先查模型而不是查标定
date: 2026-09-09 09:30:00
permalink: /2026/09/09/urdf-robot-state-publisher-tf-tree/
categories: [技术, AI机器人]
tags: [URDF, TF, robot_state_publisher, 坐标系]
---

定位结果有系统性偏差的时候，第一反应总是怀疑标定。但我遇到过的几次里，至少一半是 TF 树本身就有问题：某个坐标系压根不在树里、父子关系接反了、或者关节值根本没驱动对应的变换。

拿一个结构错的树去做标定，只会把结构错误吸收进参数里，问题被藏得更深。

<div class="note-flow"><span>URDF 描述连杆与关节</span><i>→</i><span>robot_state_publisher 读模型</span><i>→</i><span>订阅 joint_states</span><i>→</i><span>算各连杆位姿</span><i>→</i><span>发布 TF 变换</span><i>→</i><span>下游按 frame 查询</span></div>

<figure class="note-visual"><figcaption><span>从模型到变换</span>URDF 只描述结构，真实关节值来自 joint_states。缺一个，TF 树都不完整。</figcaption><div class="note-map"><span><b>link</b><small>坐标系节点，本身没有自由度。</small></span><span><b>joint</b><small>定义父子 link 和运动类型，是变换的来源。</small></span><span><b>URDF</b><small>静态结构描述，可用 xacro 生成，不含运行时数值。</small></span><span><b>joint_states</b><small>运行时关节值，由驱动或仿真发布。</small></span><span><b>robot_state_publisher</b><small>把结构加数值算成 TF 变换。</small></span><span><b>frame_id</b><small>查询用的名字，必须和树里完全一致。</small></span></div></figure>

## 第一步看树连不连通

第一个要查的不是标定参数，是坐标系能不能查到、链路完不完整：

```bash
ros2 run tf2_tools view_frames
ros2 run tf2_ros tf2_echo base_link camera_link
```

`view_frames` 会输出一张包含所有坐标系和连接关系的图。相机坐标系如果根本不在图上，后面的定位误差就无从谈起。它在图上但和基座不在同一条链路上，说明中间少了一个关节或一棵子树。

经常碰到的情况：关节的 `parent` 和 `child` 写反，变换方向就反了；模型里出现两个 `base_link`，树分了叉；固定关节被误写成可动关节，静态部分被当成运行时数值。

## 数值来源要和模型对上

URDF 给结构，`/joint_states` 给数值，两者按关节名对齐。名字对不上的关节不会报错，只是保持默认位置，表现为某个部件在 RViz 里一直不动。

```bash
ros2 topic echo /joint_states --once
ros2 param get /robot_state_publisher robot_description | head -c 200
```

比对时看三件事：关节名是不是完全一致（含命名空间前缀），关节值单位是不是弧度，`joint_states` 的时间戳有没有在推进。时间戳停住的关节值会被 TF 按过期处理，查询时得到外推失败或者旧值。

## 固定关节和静态变换别重复发

不做运动的坐标系不需要 `robot_state_publisher` 参与，用静态变换发布就行：

```bash
ros2 run tf2_ros static_transform_publisher \
  --x 0.1 --y 0 --z 0.3 --roll 0 --pitch 0 --yaw 0 \
  --frame-id base_link --child-frame-id lidar_link
```

这里很容易出现重复发布：同一个变换既在 URDF 里作为固定关节，又额外起了一个静态发布者。两个来源数值不一致时，下游查到什么取决于时序，表现为偶发跳变。

选择原则很简单：属于机器人模型的固定关节放 URDF，传感器安装外参要么全放 URDF，要么全用静态发布，别混着来。

## 和标定的边界

TF 树正确是标定有意义的前提。`base_link` 到 `camera_link` 的变换本身就错了，手眼标定会把这个结构错误吸收进去，表现为“参数看着怪但误差不大”；一旦结构修正，标定就得重做。

所以排查顺序是先验树结构和数值来源，确认静态部分符合设计，再进标定环节。这两类问题的证据不一样：结构问题看树和关节名，标定问题看残差和任务误差。

## 参考资料

- [ROS 2 URDF 教程入口](https://docs.ros.org/en/jazzy/Tutorials/Intermediate/URDF/URDF-Main.html)
- [robot_state_publisher 包文档](https://docs.ros.org/en/jazzy/p/robot_state_publisher/)
- [用 robot_state_publisher 发布机器人状态](https://docs.ros.org/en/jazzy/Tutorials/Intermediate/URDF/Using-URDF-with-Robot-State-Publisher.html)

**证据边界：**本文不包含任何具体机器人的模型文件或标定结果。上面的命令用来检查结构一致性；“树正确”只能说明坐标系关系符合模型描述，证明不了标定精度或者传感器数据本身是对的。
