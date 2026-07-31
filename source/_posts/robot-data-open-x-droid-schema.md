---
title: Open X-Embodiment 与 DROID：跨机器人数据最难的是动作含义一致
date: 2026-09-03 09:30:00
allow_future: true
source_published_at: 2024-03-19
permalink: /2026/09/03/robot-data-open-x-droid-schema/
categories: [技术, AI机器人]
tags: [Open X-Embodiment, DROID, RLDS, 机器人数据, VLA]
---

两个数据集都写着 `action[0] = 0.1`，含义可能差得很远。一个表示末端沿基座坐标系移动 0.1 米，另一个表示关节速度归一化后的 10%，还有一个可能是 100 ms 内的位姿增量。把数组补到同样长度，只解决了文件形状，没有解决动作语义。

Open X-Embodiment 和 DROID 都在扩大真实机器人数据的覆盖，但路线不同。Open X-Embodiment 聚合多机构、多机器人数据并统一格式，研究跨本体迁移；DROID 用相对统一的硬件和采集流程，去许多真实场景收集操作数据。前者把“机器人不一样”摆到台面上，后者把“环境不一样”采得更密。

<div class="note-flow"><span>读取原始 episode 与设备元数据</span><i>→</i><span>解析观测、动作和时间语义</span><i>→</i><span>转换到显式公共 schema</span><i>→</i><span>按本体和场景分组质检</span><i>→</i><span>训练后做跨域与本机评测</span></div>

<figure class="note-visual"><figcaption><span>跨机器人数据图</span>统一容器只负责让样本能被读取，单位、坐标系和控制语义需要额外适配。</figcaption><div class="note-map"><span><b>Episode</b><small>一段任务轨迹，包含边界、任务描述和完成状态。</small></span><span><b>Observation</b><small>图像、本体状态、力觉和时间戳，字段缺失要显式记录。</small></span><span><b>Action</b><small>绝对或增量、关节或笛卡尔、位置或速度，必须写清单位。</small></span><span><b>Embodiment</b><small>机器人、夹爪、相机布局、关节顺序和控制器版本。</small></span><span><b>Normalization</b><small>统计范围应按数据域保存，不能只留归一化后的数。</small></span><span><b>Split</b><small>按场景、物体和采集者隔离，避免相邻帧泄漏到测试集。</small></span></div></figure>

## 两个数据集各自解决了什么

Open X-Embodiment 论文汇集了 21 个机构、22 种机器人数据，并覆盖 527 种技能。数据以标准化格式提供，RT-X 实验用来研究不同机器人经验能否产生正迁移。这类集合的价值是让“跨本体”成为可训练、可比较的问题，而不是默认所有机械臂都一样。

DROID 论文报告 7.6 万条示教轨迹、约 350 小时交互，覆盖 564 个场景和 84 个任务，由 50 名采集者在多个地区用 12 个月完成。它的重点是把相对统一的操作平台搬到办公室、住宅等不同现场，让场景、物体和操作者的变化进入数据。

这些数字只能说明论文数据的构成，不能保证下载后就适合自己的任务。Open X 的动作空间差异更大，DROID 的硬件统一程度较高，但二者都和目标机器人存在相机、夹爪、控制频率与任务分布差异。

## RLDS 统一了容器，没有统一物理意义

Open X-Embodiment 广泛使用 RLDS 表达轨迹。核心结构可以理解为 dataset 里有 episodes，每个 episode 又是按时间排列的 steps。step 常包含 `observation`、`action`、`reward`、`is_first`、`is_last`、`is_terminal` 等字段。

这使数据加载器能用相似方式遍历不同集合，但 `observation` 和 `action` 的子字段仍由数据集定义。`action` 是 7 维，不说明前 6 维一定是末端位姿；`image` 是 RGB，也不说明它来自头部相机还是腕部相机。适配器必须把原字段转换成一个显式 schema：

```yaml
embodiment_id: franka_parallel_gripper_v2
observation:
  cameras:
    - {name: front, frame_id: camera_front_optical, width: 640, height: 480}
    - {name: wrist, frame_id: camera_wrist_optical, width: 640, height: 480}
  state:
    type: joint_position
    order: [joint1, joint2, joint3, joint4, joint5, joint6, joint7, gripper]
action:
  type: delta_end_effector
  frame_id: base_link
  order: [dx, dy, dz, droll, dpitch, dyaw, gripper]
  units: [m, m, m, rad, rad, rad, normalized]
  dt_s: 0.05
```

转换后仍要保留原始字段和适配器版本。若只保存转换结果，发现坐标轴方向错了以后无法追溯。

## 六种很像、却不能直接拼接的动作

机器人数据里常见的动作表示至少包括：关节位置、关节速度、关节增量、末端绝对位姿、末端位姿增量和力矩。夹爪又可能用开合位置、速度、二值命令或力来表示。

合并前逐项问：

1. 参考坐标系是基座、世界、末端还是相机？
2. 旋转使用欧拉角、轴角、四元数还是 6D 表示？
3. 数值是当前时刻目标，还是下一控制周期的增量？
4. 控制器实际执行频率是多少，中间有没有插值？
5. 归一化统计来自整库、单机器人还是单任务？
6. 夹爪的正方向和完成条件是什么？

这些问题缺一项，跨机器人训练得到的“泛化”可能只是模型学会识别数据集 ID，然后切换不同输出习惯。

下面的 Python 校验器要求动作元数据完整，并检查样本维度：

```python
ACTION_FIELDS = {"type", "frame_id", "order", "units", "dt_s"}

def validate_action_schema(schema: dict, sample: list[float]) -> None:
    missing = ACTION_FIELDS - schema.keys()
    if missing:
        raise ValueError(f"missing action metadata: {sorted(missing)}")
    width = len(schema["order"])
    if len(schema["units"]) != width or len(sample) != width:
        raise ValueError("action order, units and sample width disagree")
    if schema["dt_s"] <= 0:
        raise ValueError("dt_s must be positive")
    if schema["frame_id"] == "unknown":
        raise ValueError("action frame must be explicit")

schema = {
    "type": "delta_end_effector",
    "frame_id": "base_link",
    "order": ["dx", "dy", "dz", "droll", "dpitch", "dyaw", "gripper"],
    "units": ["m", "m", "m", "rad", "rad", "rad", "normalized"],
    "dt_s": 0.05,
}
validate_action_schema(schema, [0.0] * 7)
print("action schema accepted")
```

这段检查不会证明坐标系写对了。还要把一小段动作反解到可视化或仿真中，确认正方向、尺度和夹爪状态。

## 时间对齐比补齐帧数更重要

多数据集往往有不同采样率。把 30 Hz 图像、20 Hz 动作和 100 Hz 关节状态都重采样到 10 Hz，看起来整齐，却可能把快速接触事件折掉。更糟的是，有些数据只有数组索引，没有硬件时间戳；相机和控制器的固定延迟被隐藏在 episode 内。

适配时应保留原始时间戳，明确采用“最近值、线性插值、窗口聚合”中的哪一种，并记录最大时间差。图像关联动作时，要问动作是根据这帧图像计算的，还是在这帧之后才执行。这个差值直接影响视觉策略学到的闭环延迟。

相机坐标和时间的基础可以回看[《ROS 2 TF2 入门》](/2026/05/21/ros2-tf2-frame-time-basics/)。采集自己的数据时，再用[《rosbag2 故障回放》](/2026/08/24/ai-robot-rosbag2-failure-replay/)保存 TF、关节状态、诊断和任务 ID。

## 数据划分要防相邻帧泄漏

随机打散 step 再切训练集和测试集，会把同一条轨迹的相邻画面放到两边。背景、物体位置甚至手臂姿态几乎相同，测试结果自然偏高。机器人数据更适合按完整 episode 切分；要评估新场景，就按场景 ID 隔离；要评估新物体，就按物体实例隔离。

跨本体评测还需要 leave-one-embodiment-out 或明确的新机器人适配协议。若测试机器人已经贡献了大量预训练数据，结果不能写成真正的未见本体泛化。

数据规模会继续增大，真正稀缺的是可解释的动作语义、失败片段和可靠划分。把 schema 和来源链做好，比再下载一个数据集更能减少后面的无效训练。

## 参考资料

- [Open X-Embodiment: Robotic Learning Datasets and RT-X Models](https://arxiv.org/abs/2310.08864)
- [Open X-Embodiment project](https://robotics-transformer-x.github.io/)
- [DROID: A Large-Scale In-The-Wild Robot Manipulation Dataset](https://arxiv.org/abs/2403.12945)
- [DROID project](https://droid-dataset.github.io/)
- [RLDS: an Ecosystem to Generate, Share and Use Datasets in Reinforcement Learning](https://arxiv.org/abs/2111.02767)

## 证据边界

机构、机器人、技能、轨迹、时长和场景数量来自 Open X-Embodiment 与 DROID 论文。本站没有下载完整数据，也没有训练 RT-X 或 DROID 策略。公共 schema 和校验代码是适配建议，不代表原数据已经包含全部字段。不同数据集能否合并，仍要逐库核对官方 builder、许可证、动作定义与采集时间语义。
