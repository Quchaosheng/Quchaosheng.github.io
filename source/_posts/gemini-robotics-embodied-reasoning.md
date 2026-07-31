---
title: Gemini Robotics 论文拆解：具身推理和直接控制是两条不同路线
date: 2026-09-01 09:30:00
allow_future: true
source_published_at: 2025-03-25
permalink: /2026/09/01/gemini-robotics-embodied-reasoning/
categories: [技术, AI机器人]
tags: [Gemini Robotics, 具身智能, VLA, 空间推理, 论文导读]
---

机器人看到桌上有杯子，不等于它已经知道怎么抓。识别类别之后，还要选抓取位置、理解遮挡、把不同相机里的同一物体对上，再决定轨迹。Gemini Robotics 论文把这件事分成两种模型：Gemini Robotics 可以直接产生机器人动作，Gemini Robotics-ER 输出与物理世界有关的推理结果。二者名字很近，工程接口却完全不同。

<div class="note-flow"><span>多视角图像与任务指令</span><i>→</i><span>ER 产生目标、空间关系或候选轨迹</span><i>→</i><span>规划器验证可达性与碰撞</span><i>→</i><span>VLA 或技能控制器生成动作</span><i>→</i><span>执行中重新观测并拒绝失效计划</span></div>

<figure class="note-visual"><figcaption><span>两条接入路线</span>推理模型可以当感知与规划助手，VLA 可以直接给动作；两条路线需要不同的验证门。</figcaption><div class="note-map"><span><b>Gemini 2.0 基础</b><small>提供图像、语言和长上下文能力。</small></span><span><b>Robotics-ER</b><small>面向检测、指点、抓取、轨迹、多视角和三维推理。</small></span><span><b>Robotics VLA</b><small>把视觉语言条件直接映射到机器人动作。</small></span><span><b>适配数据</b><small>新技能和新本体仍依赖目标设备上的示教与微调。</small></span><span><b>确定性规划</b><small>检查坐标系、逆解、碰撞、速度和工作空间。</small></span><span><b>安全链路</b><small>限位、急停和保护区独立于模型语义判断。</small></span></div></figure>

## ER 输出的是机器人可用的中间量

Gemini Robotics-ER 中的 ER 是 Embodied Reasoning。论文列出的能力包括物体检测、指点、轨迹与抓取预测、多视角对应和三维包围盒。这些输出比一句自然语言更接近机器人接口，但还不是电机命令。

例如模型在相机坐标系中给出一个抓取点，系统还要知道相机内外参、深度来源和时间戳，才能把点变换到 `base_link`。若图像在机械臂运动前采集，抓取点到达执行器时可能已经过期。一个像样的 ER 响应至少要有：

```json
{
  "request_id": "pick-0187",
  "frame_id": "camera_color_optical_frame",
  "captured_at": "2026-09-01T09:30:12.220+08:00",
  "output_type": "grasp_candidates",
  "candidates": [
    {"position_m": [0.12, -0.08, 0.63], "score": 0.78}
  ],
  "model_version": "record-the-real-version-here"
}
```

`score` 只是模型排序依据，不能直接当作安全概率。候选还要经过 TF 变换、深度有效性、逆运动学、碰撞和夹爪宽度检查。若响应没有 `frame_id` 与采样时间，再高的分数也无法可靠执行。

下面的 Python 代码会挡住最常见的接口缺口：

```python
from datetime import datetime

def validate_er_response(data: dict) -> None:
    required = {"request_id", "frame_id", "captured_at", "output_type", "candidates", "model_version"}
    missing = required - data.keys()
    if missing:
        raise ValueError(f"missing fields: {sorted(missing)}")
    captured_at = datetime.fromisoformat(data["captured_at"])
    if captured_at.tzinfo is None:
        raise ValueError("captured_at must include timezone")
    if data["output_type"] == "grasp_candidates":
        for item in data["candidates"]:
            if len(item.get("position_m", [])) != 3:
                raise ValueError("grasp position must be xyz in meters")

sample = {
    "request_id": "pick-0187",
    "frame_id": "camera_color_optical_frame",
    "captured_at": "2026-09-01T09:30:12.220+08:00",
    "output_type": "grasp_candidates",
    "candidates": [{"position_m": [0.12, -0.08, 0.63], "score": 0.78}],
    "model_version": "experiment-a"
}
validate_er_response(sample)
print("schema accepted; geometry still needs validation")
```

这段代码只检查格式。坐标变换与碰撞验证要使用机器人自己的 TF、URDF 和规划场景。

## 直接 VLA 路线少了中间接口，也少了可见性

Gemini Robotics VLA 直接控制机器人，论文强调三类能力：适应新物体和环境，按开放词汇指令工作，以及完成需要灵巧、反应式动作的操作。端到端路线减少了手写感知与规划模块，也让失败原因更难分开。

如果机械臂抓偏了，可能是模型认错物体、抓取表示错误、动作尺度不匹配，也可能是输入画面比关节状态晚了 150 ms。传统流水线能分别检查检测结果、抓取候选和规划器日志，端到端 VLA 必须额外记录模型输入、动作 chunk、执行反馈和中间任务状态，否则只能看到“失败”。

所以接入方式不应由“哪个模型更强”决定，而要看系统需要什么证据：

| 接入方式 | 好处 | 主要代价 | 适合的第一步 |
| --- | --- | --- | --- |
| ER 输出候选 | 可插入现有规划器，几何检查清楚 | 中间接口多，坐标与标定工作重 | 离线图像与录包评测 |
| VLA 输出动作 | 能学习难以手写的视觉运动映射 | 失败定位和安全验证更难 | 低速、受限工作空间 |
| ER 生成技能参数 | 保留行为树或技能库 | 能力受已有技能边界限制 | 现场已有成熟控制栈 |

对已有 ROS 2 机器人，第三条通常更容易审计。模型选择 `pick(object_id)` 或 `place(target_pose)`，行为树和控制器仍掌握取消、恢复与限位。等这条链路的日志和验收成熟，再评估是否让 VLA接管更低层动作。

## 少量示教的数字该怎么读

论文报告，在所选 8 个短时新任务中，使用不超过 100 条示教做适配后，有 7 个任务达到 70% 以上成功率，并给出不同任务和基线的具体差异。这是很有信息量的结果，但“100 条示教”不是所有新任务的通用门槛。

示教数量相同，覆盖范围可能完全不同。100 次都在同一光照、同一物体位置采集，只能把局部分布采得更密；分散到多个物体、背景和失败恢复，单一条件下的样本又会变少。记录示教时至少分开统计物体实例、初始位姿、操作者、成功与失败、相机条件和接触状态。

新本体适配还多一层动作空间差异。论文展示了对新机器人形态的适配能力，不表示一个现成 checkpoint 能绕过标定直接控制任意机械臂。关节顺序、夹爪语义、动作频率和相机布局仍要重新定义。

## 空间推理能力不是功能安全

模型能回答“人站在机械臂附近”或“这条轨迹可能碰到物体”，属于语义与空间推理。功能安全要求在规定故障下，以可验证的时限进入安全状态。两者不能用同一套证据替代。

合理分工是：模型提供候选和语义风险信号，规划器做几何与动力学约束，安全 PLC、驱动器或独立控制线程处理急停、速度限制、保护区和通信看门狗。模型服务崩溃时，最下层仍能停车；安全 I/O 触发时，也不需要等模型确认。

这和[《VLA 规划接入机器人》](/2026/08/13/ai-robot-vla-human-intervention-state-machine/)中的 `Proposed -> Validated -> Executing` 状态一致。Gemini Robotics 扩大了候选能力，没有取消验证状态。验收时还应对照[《AI 机器人验收报告》](/2026/08/25/ai-robot-acceptance-evidence/)，把论文结果、离线结果、仿真结果和真机证据分栏记录。

## 值得跟踪的不是演示视频数量

后续版本是否真正前进，可以盯四个可核验问题：有没有更明确的动作和空间输出接口，有没有公开到足以复现实验的模型或评测协议，是否报告跨环境失败分布，以及系统安全层能否独立于模型运行。演示任务变多很直观，却回答不了部署时最难的边界。

## 参考资料

- [Gemini Robotics: Bringing AI into the Physical World](https://arxiv.org/abs/2503.20020)
- [Google DeepMind: Gemini Robotics brings AI into the physical world](https://deepmind.google/blog/gemini-robotics-brings-ai-into-the-physical-world/)
- [OpenVLA](https://arxiv.org/abs/2406.09246)
- [ROS 2 TF2 concepts](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Tf2.html)

## 证据边界

模型家族、ER 能力、新任务示教数量和论文实验结论来自 Gemini Robotics 技术报告。本站没有模型访问权，也没有复现 Google DeepMind 的机器人实验。接口 schema、接入表和安全分层是工程分析，不代表官方 API 或安全认证结论。任何抓取点、轨迹或动作在真机执行前都要经过目标设备的标定、规划、限位与故障测试。
