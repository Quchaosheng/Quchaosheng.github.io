---
title: 机器人运动学入门：关节空间、位姿和雅可比矩阵
date: 2026-06-11 09:30:00
permalink: /2026/06/11/robot-kinematics-jacobian-basics/
categories: [技术, AI机器人]
tags: [机器人运动学, 关节空间, 位姿, 雅可比, MoveIt]
---

机械臂末端只想向前移动 1 cm，控制器却要同时改变好几个关节。反过来，给定一个目标位姿，逆解可能返回多组关节角，也可能完全无解。理解机器人运动学，先要接受一件事：末端位姿和关节角是两套不同坐标，二者通过机械结构和当前姿态联系起来。

<div class="note-flow"><span>定义关节与连杆</span><i>→</i><span>由关节角计算末端位姿</span><i>→</i><span>由目标位姿求逆解</span><i>→</i><span>用雅可比连接速度</span><i>→</i><span>检查奇异与关节限位</span></div>

<figure class="note-visual"><figcaption><span>运动学关系图</span>正运动学从关节到末端，逆运动学从末端目标回到一组可执行关节角。</figcaption><div class="note-map"><span><b>关节空间</b><small>由每个转动或移动关节的变量组成，控制器最终执行这一层。</small></span><span><b>任务空间</b><small>末端位置和姿态所在空间，更接近抓取与装配目标。</small></span><span><b>正运动学</b><small>给定关节角，计算末端相对基座的位姿。</small></span><span><b>逆运动学</b><small>给定末端目标，寻找满足限位和约束的关节解。</small></span><span><b>雅可比</b><small>在当前姿态附近连接关节速度与末端速度。</small></span><span><b>奇异</b><small>某些方向需要极大关节速度，数值解和控制会变得敏感。</small></span></div></figure>

## 关节空间和任务空间

六轴机械臂的关节状态可写成向量：

```text
q = [q1, q2, q3, q4, q5, q6]
```

末端位姿通常包含三维位置和旋转。工程里常用齐次变换矩阵、四元数或位置加姿态表示。位置单位、旋转顺序和参考坐标系必须明确，否则同一组数字可能表示完全不同的姿态。

ROS 2 可以先查看关节消息：

```bash
ros2 interface show sensor_msgs/msg/JointState
ros2 topic echo --once /joint_states
```

`JointState.name` 与 position 数组的顺序必须对应。依赖固定下标又不检查名称，是多机械臂或控制器切换时常见的错误。

## 正运动学做了什么

正运动学把每个关节变换连乘，得到末端相对基座的变换：

```text
T_base_tool(q) = T_0_1(q1) * T_1_2(q2) * ... * T_5_6(q6)
```

URDF 中的关节轴、固定变换和 link 几何决定这些矩阵。模型里的轴方向或安装偏移错误，算法再精确也会得到错误末端位置。调试时先在几个容易测量的姿态下比较 TF、机械尺寸和真实末端位置。

```bash
ros2 run tf2_ros tf2_echo base_link tool0
```

### 用二连杆算一次末端位置

平面二连杆是最小的正运动学例子。设两段长度分别为 `l1`、`l2`，关节角为 `q1`、`q2`：

```text
x = l1*cos(q1) + l2*cos(q1 + q2)
y = l1*sin(q1) + l2*sin(q1 + q2)
```

下面的 Python 代码可以直接运行，角度先转成弧度：

```python
import math

l1, l2 = 0.4, 0.3
q1 = math.radians(30.0)
q2 = math.radians(-45.0)

x = l1 * math.cos(q1) + l2 * math.cos(q1 + q2)
y = l1 * math.sin(q1) + l2 * math.sin(q1 + q2)
print(f"tool position: x={x:.4f}, y={y:.4f}")
```

这个例子没有姿态、三维旋转和关节偏置，但能帮助确认关节角改变后，末端位置为什么一起变化。

## 逆运动学为什么会有多解

同一个末端位姿可能对应肘上、肘下或腕部翻转等多组关节角。求解器还要考虑关节限位、碰撞、种子姿态和数值容差。只要得到一个数学解，并不代表它适合当前任务。

逆解接口应返回至少三类结果：找到可执行解、目标不可达、求解超时。控制器不能在逆解失败后继续使用上一组关节目标。

## 雅可比连接局部速度

在当前姿态附近，关节速度和末端速度满足近似关系：

```text
v_tool = J(q) * q_dot
```

`J(q)` 随姿态变化。视觉伺服或笛卡尔速度控制会根据期望末端速度求关节速度。若雅可比接近奇异，直接求逆会放大噪声，常用伪逆、阻尼最小二乘和速度限制减轻问题。

```text
q_dot = J_pinv * v_tool
```

公式只是局部速度关系。离目标很远、周期太长或速度过大时，线性近似会变差，需要滚动更新并检查轨迹。

## 奇异位置会怎样表现

机械臂伸直、腕轴对齐等姿态可能让某些任务方向失去独立运动能力。常见现象包括关节速度突然变大、末端抖动、逆解在不同分支间跳变。可以记录雅可比条件数、最小奇异值、关节速度和限位余量，提前降速或换姿态。

| 检查项 | 问题表现 | 处理方向 |
| --- | --- | --- |
| 关节限位 | 逆解有数学解但不可执行 | 换种子或重新规划 |
| 奇异性 | 关节速度放大 | 阻尼伪逆、降速、避开姿态 |
| 模型外参 | 末端位置系统性偏差 | 校验 URDF、工具和基座标定 |
| 控制周期 | 笛卡尔轨迹不平滑 | 缩短周期并限制速度变化 |

## 学完后接哪几篇

先用 [TF2 坐标与时间基础](/2026/05/21/ros2-tf2-frame-time-basics/)确认坐标树，再看[视觉伺服端到端延迟](/2026/08/04/ai-robot-visual-servo-latency-budget/)。运动学解决几何映射，TF2 解决不同坐标系和时间的关系，控制延迟则决定这次计算是否已经过期。

## 参考资料

- [Modern Robotics](https://modernrobotics.northwestern.edu/nu-gm-book-resource/)
- [MoveIt kinematics](https://moveit.picknik.ai/main/doc/concepts/kinematics.html)
- [REP 103 coordinate conventions](https://www.ros.org/reps/rep-0103.html)
- [ROS 2 JointState](https://docs.ros.org/en/jazzy/p/sensor_msgs/msg/JointState.html)

**证据边界：**公式描述一般刚体运动学和局部速度关系，没有给出某个机械臂的 DH 参数、逆解性能或奇异阈值。真实系统必须结合 URDF、关节限位、标定和控制周期验证。
