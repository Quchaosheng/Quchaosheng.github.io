---
title: OpenVLA-OFT 论文拆解：连续动作、并行解码和控制频率怎么连起来
date: 2026-08-27 09:30:00
allow_future: true
source_published_at: 2025-02-27
permalink: /2026/08/27/openvla-oft-action-chunk-continuous/
categories: [技术, AI机器人]
tags: [OpenVLA-OFT, VLA, Action Chunking, 模仿学习, 论文导读]
---

把 OpenVLA 微调到一台新机械臂上，最先撞到的未必是显存。原版模型用自回归方式生成动作 token，一段动作要按序吐出来；控制程序还在等后面的 token 时，相机画面已经变旧。若只盯着 LoRA 秩和 batch size，这个延迟问题不会自己消失。

OpenVLA-OFT 研究的正是这层接口。作者没有把重点放在换一个更大的视觉语言骨干，而是比较动作解码、动作表示和训练目标，最后组合出并行解码、动作分块、连续动作表示与 L1 回归。它给出的提醒很实在：VLA 微调方案同时决定策略学得怎样，以及动作能不能按时送到控制器。

<div class="note-flow"><span>读取图像、语言和本体状态</span><i>→</i><span>并行生成连续动作 chunk</span><i>→</i><span>检查时间戳与动作范围</span><i>→</i><span>执行 chunk 的前一小段</span><i>→</i><span>用新观测滚动规划</span></div>

<figure class="note-visual"><figcaption><span>OFT 设计图</span>四个训练选择最后都要落到同一件事：在动作失效前交给确定性控制层。</figcaption><div class="note-map"><span><b>并行解码</b><small>动作槽位同时产生，减少自回归序列带来的等待。</small></span><span><b>连续动作</b><small>直接回归关节或末端动作，避开离散量化误差。</small></span><span><b>Action chunk</b><small>一次预测一段未来动作，摊薄一次视觉推理的成本。</small></span><span><b>L1 目标</b><small>用直接回归训练动作头，论文实验中比复杂目标更合适。</small></span><span><b>滚动执行</b><small>只消费 chunk 的一部分，再根据新画面重算。</small></span><span><b>安全执行</b><small>范围、速度、碰撞和过期检查仍由模型外完成。</small></span></div></figure>

## 改的不是一个超参数

OpenVLA 的开放权重让微调可操作，但原始动作接口保留了语言模型的自回归习惯。自回归适合文本，因为后一个词依赖前一个词；机器人动作却有另一种结构。同一时刻的各关节分量属于一个向量，未来几十个控制点也常作为一个整体优化。把它们强行排成很长的 token 串，会把串行解码时间带进控制回路。

OFT 为动作 chunk 准备一组输出槽位，让模型并行预测这些位置。这里有两个不同的“并行”，不能混为一谈：

1. 同一次推理内，动作维度和未来时间槽不再逐 token 等待。
2. 推理线程和控制线程可以异步工作，控制器消费当前 chunk 时，推理器准备下一段。

论文主要处理第一层。第二层仍需要队列、时间戳和超时策略，后面的 SmolVLA 文章会专门讨论。

## 连续回归省掉了什么

离散动作 token 要先确定每个动作维度的范围，再切成若干 bin。假设末端位移范围是 `[-0.05, 0.05] m`，分成 256 档，单档约为 `0.39 mm`。这个数看上去够细，可它只描述量化分辨率，没有包含标定误差、齿隙、控制周期和多步累计误差。换了一台行程更大的机械臂，原来的分桶边界也未必合适。

连续动作头直接输出浮点向量，省掉 token 化和反量化。它并不自动解决尺度问题。训练前仍要记录每个维度的单位、分位数、裁剪范围和归一化方式；推理后还要恢复到目标机器人的动作空间。最危险的错误不是精度少了一位，而是把弧度当角度、把绝对位姿当增量位姿。

可以把动作契约写成一份不依赖模型的清单：

```yaml
action_schema:
  representation: delta_end_effector
  order: [dx, dy, dz, droll, dpitch, dyaw, gripper]
  units: [m, m, m, rad, rad, rad, normalized]
  control_hz: 20
  chunk_size: 16
  execute_steps: 4
  max_age_ms: 180
  clip_abs: [0.03, 0.03, 0.03, 0.15, 0.15, 0.15, 1.0]
```

训练代码、推理服务和控制器都应读取同一份契约。若三处各写一套常量，模型版本一换，错误很难从轨迹里看出来。

## 26 倍吞吐不能直接写成 26 倍控制频率

OpenVLA-OFT 论文报告：在它的实验设置中，LIBERO 四个任务套件的平均成功率从 76.5% 提高到 97.1%，动作生成吞吐提高 26 倍。真实机器人比较还报告了相对若干 VLA 和模仿学习基线的结果。这些数字属于论文所用模型、硬件、实现和评测协议。

动作吞吐只是端到端周期的一段。一个视觉闭环的年龄还包含相机曝光、传输、预处理、GPU 排队、模型推理、消息传递和控制器排队：

```text
action_age = camera_age
           + preprocess_time
           + inference_queue_time
           + model_time
           + transport_time
           + controller_queue_time
```

并行解码把 `model_time` 压下去，不会缩短曝光，也不会清掉 ROS 2 中已经排队的旧命令。若动作 chunk 在网络里积压，吞吐越高，旧动作反而可能越多。部署报告至少要同时给出 P50、P99 推理延迟，输入帧年龄，chunk 产生时间，以及实际执行时的动作年龄。

## 控制器需要会拒绝一个 chunk

下面这段 Python 展示最小检查。它不判断碰撞，只负责挡住过期、形状错误和越界动作，可以直接保存运行：

```python
from dataclasses import dataclass
from time import monotonic

@dataclass
class ActionChunk:
    created_s: float
    values: list[list[float]]

LIMITS = [0.03, 0.03, 0.03, 0.15, 0.15, 0.15, 1.0]

def validate(chunk: ActionChunk, max_age_ms: float = 180.0) -> None:
    age_ms = (monotonic() - chunk.created_s) * 1000
    if age_ms > max_age_ms:
        raise ValueError(f"stale action chunk: {age_ms:.1f} ms")
    if not chunk.values or any(len(step) != len(LIMITS) for step in chunk.values):
        raise ValueError("unexpected action shape")
    for step in chunk.values:
        if any(abs(value) > limit for value, limit in zip(step, LIMITS)):
            raise ValueError(f"action exceeds limits: {step}")

sample = ActionChunk(monotonic(), [[0.01, 0, 0, 0, 0, 0, 0.5]] * 4)
validate(sample)
print("chunk accepted")
```

真实系统还要验证坐标系、速度和加速度连续性、关节限位、规划碰撞、夹爪状态与任务 ID。通过校验只表示 chunk 可以交给下一层，不表示机械臂已经安全。

## 复现时先固定四个变量

项目代码可以从官方项目页进入，先记录仓库版本和环境，不要一上来就训练：

```bash
git clone --depth 1 https://github.com/moojink/openvla-oft
git -C openvla-oft rev-parse HEAD
git -C openvla-oft status --short
```

第一次对比建议固定数据划分、图像预处理、动作归一化和评测种子，只替换一种动作头。随后分别测单步输出与 action chunk、离散表示与连续表示、串行与并行解码。若四项一起换，成功率变了也解释不了原因。

这篇可以和[《ALOHA 与 ACT 论文导读》](/2026/07/01/aloha-act-paper-reading/)对照着看。ACT 解释动作分块为什么有用，OFT 则说明 VLA 微调时怎样把分块和输出头接起来。真正接入 ROS 2 前，再用[《VLA 规划接入机器人》](/2026/08/13/ai-robot-vla-human-intervention-state-machine/)补上取消与人工接管。

## 参考资料

- [Fine-Tuning Vision-Language-Action Models: Optimizing Speed and Success](https://arxiv.org/abs/2502.19645)
- [OpenVLA-OFT project](https://openvla-oft.github.io/)
- [OpenVLA](https://arxiv.org/abs/2406.09246)
- [ACT / Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware](https://arxiv.org/abs/2304.13705)

## 证据边界

文中的 76.5%、97.1%、26 倍和真实机器人比较均来自 OpenVLA-OFT 论文，不是本站复现实验。动作契约和校验代码是工程示例，没有覆盖具体机械臂的动力学、碰撞与功能安全要求。若要判断 OFT 是否适合某台设备，仍需在固定数据划分和目标硬件上测成功率、长尾延迟、动作年龄与拒绝率。
