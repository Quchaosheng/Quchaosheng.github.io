---
title: π0 与 π0.5 论文拆解：VLM 怎样接上连续动作和长任务
date: 2026-08-28 09:30:00
allow_future: true
source_published_at: 2025-04-22
permalink: /2026/08/28/pi0-pi05-flow-action-expert/
categories: [技术, AI机器人]
tags: [π0, π0.5, VLA, Flow Matching, Action Expert, 论文导读]
---

“把桌面收拾干净”对语言模型是一句话，对机械臂却可能是几分钟的状态变化。杯子先移走还是先擦桌面，垃圾袋满了怎么办，中途有人放进一个新物体，这些都不是单个动作向量能回答的问题。π0 解决连续动作怎么生成，π0.5 又往上补了一层语义子任务。两篇放在一起读，才能看见长任务为什么需要快慢两种时间尺度。

<div class="note-flow"><span>图像、语言和机器人状态进入 VLM</span><i>→</i><span>预测当前语义子任务</span><i>→</i><span>action expert 生成连续动作 chunk</span><i>→</i><span>控制器执行并重新观测</span><i>→</i><span>完成或切换子任务</span></div>

<figure class="note-visual"><figcaption><span>双时间尺度</span>语义规划回答“接下来做什么”，动作专家回答“接下来几十个控制点怎么走”。</figcaption><div class="note-map"><span><b>VLM 骨干</b><small>处理图像和语言，保留互联网预训练得到的语义表示。</small></span><span><b>本体状态</b><small>关节、夹爪和平台状态进入机器人专用分支。</small></span><span><b>Action expert</b><small>较小的专用权重处理连续状态和动作。</small></span><span><b>Flow matching</b><small>从噪声动作出发，沿学习到的向量场得到动作 chunk。</small></span><span><b>语义子任务</b><small>π0.5 在长任务中显式预测当前阶段。</small></span><span><b>运行时保护</b><small>动作范围、碰撞、超时和急停不交给生成模型自由决定。</small></span></div></figure>

## π0 没让语言模型直接回归每个关节

π0 使用 PaliGemma 作为 VLM 初始化。论文描述的版本包含约 30 亿参数的 VLM 和约 3 亿参数的 action expert，总计约 33 亿参数。图像与语言 token 走较大的 VLM 权重，机器人状态和带噪动作走 action expert；两组权重通过 Transformer 的自注意力交互。

这个拆法有明确理由。视觉语言预训练擅长物体、文本和关系，机器人动作却是连续量，还带有机器形态和控制频率。若所有参数都用同一种输入输出目标训练，动作细节可能被语言目标淹没；若完全拆成两个模型，语义和运动又缺少共享上下文。action expert 处在中间：专门处理机器人 token，但仍能读取视觉语言上下文。

论文中的 50 Hz 是其系统在特定灵巧任务上的动作频率，不是说 33 亿参数模型在任意电脑上都能 20 ms 完成一次完整视觉推理。动作分块会一次产生多个 50 Hz 控制点，VLM 的运行频率可以低于底层执行频率。读延迟数据时一定要分清“动作采样频率”和“模型重新看图的频率”。

## Flow matching 在动作空间里做了什么

训练样本里有真实动作 chunk `A`。模型再采一个同形状噪声 `ε`，随机取时间 `τ`，构造中间状态：

```text
A_tau = (1 - tau) * epsilon + tau * A
target_velocity = A - epsilon
```

action expert 看到图像、语言、机器人状态、`A_tau` 和 `τ`，学习预测把当前点推向真实动作的速度场。推理时没有真实 `A`，只能从噪声开始，多次调用模型并做数值积分：

```text
A_next = A_now + delta_tau * v_theta(observation, A_now, tau)
```

这是理解 flow matching 的最小图景。实际论文实现包含动作归一化、注意力掩码、时间嵌入和模型结构细节，不能用这两行公式复现结果。它和扩散策略的共同点是都能表达多峰动作分布，区别在于训练目标和采样路径。详细比较放在[《Flow Matching 与 Diffusion Policy》](/2026/09/05/flow-matching-diffusion-robot-policy/)。

下面的 NumPy 片段只验证插值和目标速度的关系，可以直接运行：

```python
import numpy as np

rng = np.random.default_rng(7)
action = np.array([0.02, -0.01, 0.30], dtype=np.float32)
noise = rng.normal(size=action.shape).astype(np.float32)

for tau in (0.0, 0.25, 0.5, 0.75, 1.0):
    noisy_action = (1.0 - tau) * noise + tau * action
    target_velocity = action - noise
    reconstructed = noisy_action + (1.0 - tau) * target_velocity
    print(tau, np.round(reconstructed, 4))
```

在这条直线路径上，从任意 `τ` 沿目标速度走完剩余时间都会回到 `action`。真实网络的困难在于它不知道真实动作和噪声，只能从训练数据中估计条件速度场。

## π0.5 把语义动作也放进训练数据

π0 能产生灵巧的连续动作，但“整理一间陌生厨房”还需要阶段选择。π0.5 使用异构任务共同训练，把图像、语言、目标检测、语义子任务和低层动作混在同一个训练体系里。论文描述的移动操作系统采用分层推理：运行时先预测类似“拿起砧板”的语义子任务，再生成低层动作。

这不是传统规划器和控制器的简单拼接。语义预测与动作生成共享模型表示，共同训练还混入多机器人数据和 web 数据，目标是把物体知识、语言和机器人经验互相迁移。代价也很明显：数据不再只有 `(observation, action)`。一个 episode 至少要知道任务指令、当前阶段、阶段完成条件和动作时间范围。

可以把长任务标注写成下面这种形式：

```json
{
  "episode_id": "kitchen_0042",
  "instruction": "清理操作台",
  "segment": {
    "start": 180,
    "end": 326,
    "semantic_action": "把砧板放回架子",
    "completion": "board_in_rack"
  },
  "action_space": "delta_ee_7d",
  "camera_set": ["head", "wrist_left"]
}
```

`semantic_action` 不该靠事后随便补一句话。边界错了，模型会把“接近物体”和“夹紧物体”归到不同语义，或在一个标签里混入互相冲突的目标。检查数据时可以先画出每个语义段的长度分布，再抽看最短、最长和切换最频繁的 episode。

## 新房间泛化到底包含什么

π0.5 论文展示了在全新家庭环境中执行清理厨房、卧室等长时灵巧任务，并通过消融研究分析共同训练数据的作用。这个结论比“识别一个新杯子”更强，因为环境布局、物体组合和任务进程都发生了变化。

但“open-world”不是没有边界。论文系统仍有指定机器人、传感器、训练数据配方和评测流程。换成另一种夹爪、缺少腕部相机，或把任务搬到强反光工业现场，都需要重新验证。特别是长任务成功率会把很多失败折在一起：语义阶段选错、低层抓取失败、动作过期、恢复策略失效，最后都只表现为一次任务失败。

自己的评测最好拆成四层：

| 层次 | 问题 | 建议记录 |
| --- | --- | --- |
| 语义选择 | 当前子任务是否合理 | 子任务准确率、人工改写次数 |
| 动作生成 | chunk 是否贴合示教分布 | 动作越界率、平滑度、生成时间 |
| 执行闭环 | 新观测能否及时纠偏 | 输入年龄、重规划周期、拒绝率 |
| 长任务 | 多阶段能否收敛 | 完成阶段数、失败位置、恢复次数 |

只报整段成功率，很难知道下一批数据该采什么。

## 开源实现适合先读接口

Physical Intelligence 发布了 openpi 代码和模型入口。完整训练对硬件和数据要求较高，第一次接触可以只固定仓库版本并读输入输出定义：

```bash
git clone --depth 1 https://github.com/Physical-Intelligence/openpi
git -C openpi rev-parse HEAD
git -C openpi grep -n "action_chunk" -- . ':!*.ipynb'
```

读代码时重点找四处：图像如何组成 batch，本体状态怎样归一化，action horizon 和执行 horizon 各是多少，推理服务怎样携带时间戳。模型结构看懂了，动作单位没看懂，真机仍然接不上。

OpenVLA-OFT 也在解决连续 chunk 与推理速度，但训练目标不同，可以对照[上一篇](/2026/08/27/openvla-oft-action-chunk-continuous/)。若只是想建立 VLA 全景，先回到[《VLA 论文怎么读》](/2026/03/10/vla-paper-reading-guide/)，再带着“数据、动作、推理、运行时”四个问题读原论文。

## 参考资料

- [π0: A Vision-Language-Action Flow Model for General Robot Control](https://arxiv.org/abs/2410.24164)
- [π0.5: a Vision-Language-Action Model with Open-World Generalization](https://arxiv.org/abs/2504.16054)
- [Physical Intelligence: π0](https://www.pi.website/blog/pi0)
- [Physical Intelligence: π0.5](https://www.pi.website/blog/pi05)
- [Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747)

## 证据边界

模型规模、50 Hz、任务类型和新家庭环境表现来自 π0 与 π0.5 论文。本站没有获得其训练数据，也没有复现论文真机实验。公式和 NumPy 代码只解释条件 flow matching 的直线路径，不等价于 openpi 实现。对具体机器人能否迁移，只能通过目标动作空间、相机布局、推理硬件和长任务故障注入来判断。
