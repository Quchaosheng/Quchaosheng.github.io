---
title: VLA 论文怎么读：从 RT-1 到 OpenVLA，先看数据和动作接口
date: 2026-03-10 09:30:00
permalink: /2026/03/10/vla-paper-reading-guide/
categories: [技术, AI机器人]
tags: [VLA, 论文导读, RT-1, RT-2, Diffusion Policy, OpenVLA, GR00T]
---

论文里写“泛化能力提升”，工程师最容易问错一个问题：这个提升能不能直接搬到我的机械臂上？通常不能。论文里的机器人、相机、任务集合、数据分布和评测协议都是结论的一部分。换了硬件和输入，模型名字还在，结论的适用范围已经变了。

读 VLA 论文时，我会先把问题拆成五个格子：模型看到了什么，动作怎样表示，训练数据来自哪里，推理时如何产生一段动作，以及失败后谁有权停止。这样读，RT-1、RT-2、Diffusion Policy、Octo、OpenVLA 和 GR00T N1 不再是一串产品名，而是几种不同的系统取舍。

<div class="note-flow"><span>确认论文任务和硬件</span><i>→</i><span>拆出观测与动作表示</span><i>→</i><span>检查数据和评测协议</span><i>→</i><span>把方法映射到机器人接口</span><i>→</i><span>写出不能迁移的结论</span></div>

<figure class="note-visual"><figcaption><span>论文阅读地图</span>同一个“VLA”标签下，数据规模、动作头、推理方式和安全边界可能完全不同。</figcaption><div class="note-map"><span><b>观测</b><small>图像、语言、关节状态、力觉和目标图像的组合。</small></span><span><b>动作表示</b><small>离散 token、连续动作 chunk、扩散轨迹或分层技能。</small></span><span><b>数据</b><small>真实轨迹、互联网视觉语言数据、人类视频和合成数据。</small></span><span><b>推理</b><small>一次动作、滚动预测、扩散去噪或双系统协同。</small></span><span><b>适配</b><small>零样本、少量微调、新传感器和新动作空间的代价不同。</small></span><span><b>运行时</b><small>时间戳、约束、取消、人工接管和控制器拒绝仍在模型之外。</small></span></div></figure>

## 先读 RT-1：规模化首先改变的是数据问题

RT-1（Robotics Transformer）把多任务机器人轨迹放进一个可扩展的策略模型里，研究模型规模、数据量和数据多样性如何影响泛化。它给出的工程启发很朴素：想让策略处理更多任务，不能只把同一个任务的数据采得更密，还要让训练数据覆盖不同物体、位置、动作和失败情况。

RT-1 的价值不在于“Transformer 能控制机械臂”这句结论，而在于它把数据接口变成了研究对象。对自己的项目，可以先问：任务 ID、目标对象、相机视角和动作标签是否有稳定格式？不同操作者的轨迹是否真的表达同一个动作？如果这些基础问题没有解决，换更大的模型通常只会把偏差学得更快。

## RT-2 让语言模型参与动作表达

RT-2 的做法是把机器人动作表示成文本 token，与视觉语言任务一起进行 co-fine-tuning。论文报告了在新物体、未见过的命令和简单语义推理上的泛化，并在 6,000 次评测试验中观察这些能力。这里真正值得借鉴的是接口设计：动作不再是模型外面另接一个完全不同的头，而是和语言、视觉共享了一种序列化方式。

但动作 token 化也带来新的限制。离散化会引入分辨率和范围约束，输出序列的时间长度会影响延迟，语言推理的置信度也不等于位姿或力矩的安全性。把 RT-2 的结论搬到自己的机器人上时，至少要重新检查动作量化误差、输入图像年龄、规划器拒绝率和取消时间。

## Diffusion Policy 解决的是多峰动作分布

Diffusion Policy 将视觉运动策略建模为条件扩散过程，通过多步去噪生成动作序列，并结合 receding-horizon control。它适合“同一个目标有多种合理轨迹”的任务，例如从不同方向绕开障碍物抓取。论文在 12 个任务、4 个操作基准上报告了平均提升，但这个数字只属于论文的任务、数据和对比实现，不能当作通用收益。

工程上更重要的代价是推理过程。扩散步骤越多，动作生成时间越长；每次只执行一小段动作可以降低旧计划的风险，却会增加重新规划次数。部署时应把去噪步数、动作 horizon、控制周期、结果年龄和超时动作放在同一张预算表里。

## Octo 把“换机器人”当作接口问题

Octo 以 Open X-Embodiment 的 800k 条轨迹训练通用策略，论文强调语言命令、目标图像、新传感器和新动作空间的适配，并在 9 种机器人平台上做了实验。不要把 800k 读成最低数据量。更值得借鉴的是可扩展的 observation/action space，否则换一个相机或机械臂就要重写整个策略。

对项目而言，应该把相机内参、图像布局、关节顺序、动作单位和终止条件写进 schema。新设备接入时，先做适配层和少量校准，再比较策略效果。若输入字段在不同设备上含义不一致，微调数据越多，问题越难追。

## OpenVLA 的开放性有实际工程价值

OpenVLA 是 7B 参数的开源 VLA，使用 Llama 2、DINOv2 和 SigLIP 的组合，并在 970k 条真实机器人演示上训练。论文报告它在 29 个任务和多个机器人形态上超过 RT-2-X，并展示了低秩微调和量化部署路径。这里的开放内容包括模型权重、数据处理、微调和推理代码，复现时仍要核对数据许可与目标硬件。

论文同时报告了相对 Diffusion Policy 的提升，但这不是说 VLA 在所有低层控制任务都更好。OpenVLA 的优势更接近多任务语义和跨任务初始化，Diffusion Policy 在一个收敛良好的单任务上可能更简单、更容易调。选择时要看任务是否需要语言泛化、是否有足够的微调数据、推理延迟能否进入控制预算，以及出现错误时能否安全拒绝。

## GR00T N1：双系统结构把语义和动作分开

GR00T N1 的论文描述了一个双系统架构：视觉语言模块负责解释环境和指令，扩散 Transformer 负责生成连续运动。训练数据混合真实机器人轨迹、人类视频和合成数据，并在 humanoid 机器人上做了语言条件的双臂操作实验。

这个结构和工程分层很接近。语义模块可以慢一点，动作模块需要更稳定的时间预算，但两者之间的接口必须包含状态、时间戳、动作有效期和取消语义。论文展示的“能生成动作”不等于你的控制器愿意接受动作；工作空间、碰撞、力限制和急停仍应由确定性层负责。

## 用一张表把论文结论落地

| 工作 | 主要变化 | 可以借鉴 | 不能直接搬运 |
| --- | --- | --- | --- |
| RT-1 | 多任务轨迹与可扩展策略 | 统一数据和动作 schema | 论文任务集合的泛化率 |
| RT-2 | VLM 与机器人动作共同训练 | 语义输入与动作接口设计 | 互联网知识带来的安全能力 |
| Diffusion Policy | 扩散生成动作序列 | 多峰轨迹、滚动控制 | 固定去噪步数和平均提升 |
| Octo | 多平台、可适配的通用策略 | observation/action 适配层 | 800k 数据的普遍必要性 |
| OpenVLA | 开放模型与高效微调 | 可复现的微调和量化路径 | 7B 模型在本机的延迟 |
| GR00T N1 | 语义系统和动作系统分工 | 分层运行时接口 | humanoid 真机结果的迁移 |

可以用一个很小的实验记录文件把“论文结论”和“自己的证据”分开：

```json
{
  "paper_claim": "动作条件和多任务数据有助于泛化",
  "local_test": "同一相机下的三类物体抓取",
  "environment": "台架 / Jetson / model_version",
  "metric": ["success_rate", "p99_age_ms", "reject_count"],
  "evidence_boundary": "未覆盖新相机、遮挡和长时间热稳定"
}
```

```bash
jq '.paper_claim, .local_test, .metric, .evidence_boundary' paper-to-robot.json
```

这份记录不负责给论文重新打分。它只防一件事：写报告时把“论文说过”误写成“本机已经验证”。

## Sim-to-Real 论文提醒我们先量误差

Domain Randomization 的经典工作用随机纹理和渲染变化训练模拟器里的目标检测器，再转到真实环境。它的工程意义在于：随机化范围不是越大越好，应该覆盖真实世界里会影响任务的差异。相机曝光、运动模糊、材质反光和执行器延迟都比随意换一套背景更值得测量。

仿真论文和 VLA 论文要放在同一条证据链里看：仿真可以扩大数据覆盖，VLA 可以扩大任务语义，但两者都不能替代目标设备上的时间戳、动作约束和安全停止测试。

想把动作分块单独读透，可以继续看[ALOHA 与 ACT 的工程拆解](/2026/07/01/aloha-act-paper-reading/)；准备把论文模型接到 ROS 2 时，再对照[动作候选、人工接管和可取消状态机](/2026/08/13/ai-robot-vla-human-intervention-state-machine/)。前一篇追论文中的数据与模型，后一篇只处理模型外的运行时边界。

## 参考资料

- [RT-1: Robotics Transformer](https://arxiv.org/abs/2212.06817)
- [RT-2: Vision-Language-Action Models Transfer Web Knowledge to Robotic Control](https://arxiv.org/abs/2307.15818)
- [Diffusion Policy](https://arxiv.org/abs/2303.04137)
- [Octo: An Open-Source Generalist Robot Policy](https://arxiv.org/abs/2405.12213)
- [OpenVLA](https://arxiv.org/abs/2406.09246)
- [GR00T N1](https://arxiv.org/abs/2503.14734)
- [Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World](https://arxiv.org/abs/1703.06907)
- [ROS 2 Actions](https://docs.ros.org/en/jazzy/Concepts/Basic/About-Actions.html)

**证据边界：**表格中的方法概括和论文结果来自原始论文的公开摘要与正文入口。论文报告的任务、机器人、样本量和提升幅度不代表本网站或用户设备的实测结果。本文没有复现任何论文 benchmark，发布前仍应以目标模型、硬件和数据分布做独立验证。
