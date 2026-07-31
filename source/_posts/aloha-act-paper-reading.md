---
title: ALOHA 与 ACT 论文导读：动作分块为什么能改善双臂模仿学习
date: 2026-07-01 09:30:00
permalink: /2026/07/01/aloha-act-paper-reading/
categories: [技术, AI机器人]
tags: [ALOHA, ACT, 模仿学习, Action Chunking, 双臂机器人]
---

模仿学习策略每个控制周期只预测下一步动作，误差会一小步一小步累积。双臂操作更麻烦，两只手的配合跨越较长时间，单步动作很难表达“抓住后保持、另一只手继续移动”这类连续意图。ALOHA 项目中的 ACT（Action Chunking with Transformers）把一段未来动作作为一个 chunk 预测，试图缓解这种长时间协调问题。

<div class="note-flow"><span>采集双臂示教</span><i>→</i><span>编码视觉与关节状态</span><i>→</i><span>预测未来动作 chunk</span><i>→</i><span>时间集成多个预测</span><i>→</i><span>滚动执行并重新观测</span></div>

<figure class="note-visual"><figcaption><span>动作分块图</span>策略一次预测多个未来动作，执行时仍要滚动更新并处理新观测。</figcaption><div class="note-map"><span><b>示教数据</b><small>相机、关节和操作者动作必须时间对齐，错误示教会直接进入策略。</small></span><span><b>Action chunk</b><small>一次输出一段动作，提供比单步预测更长的行为上下文。</small></span><span><b>Transformer</b><small>建模视觉、状态和动作序列之间的依赖。</small></span><span><b>CVAE</b><small>表达示教中可能存在的多种动作风格和轨迹变化。</small></span><span><b>Temporal ensemble</b><small>融合不同时间点对同一未来动作的预测，减轻抖动。</small></span><span><b>滚动执行</b><small>只执行部分计划后重新观测，避免长 chunk 完全开环。</small></span></div></figure>

## ACT 想解决什么

行为克隆常把当前图像和关节状态映射到下一步动作。训练数据来自专家轨迹，部署时策略自己的微小误差会让状态逐渐偏离训练分布。动作分块不能消除分布偏移，但它让模型在一次预测里看到更长的动作结构，减少每一步独立决定造成的抖动。

论文中的 ACT 使用 Transformer 和条件变分自编码器预测动作序列，并通过 temporal ensembling 融合重叠 chunk。工程上可以把它理解成：每个控制时刻都对未来提出一段计划，多个历史计划对当前动作投票或加权。

## Chunk 长度不是越长越好

较长 chunk 可以表达完整动作片段，推理频率也可能降低；但环境发生变化时，旧计划更容易过期。较短 chunk 响应快，却更接近单步策略，长期协调能力可能变弱。

```text
chunk 太短 -> 决策频繁、误差逐步积累
chunk 太长 -> 计划陈旧、遮挡或接触变化后难以及时修正
```

选择时要同时记录任务时长、推理延迟、重规划周期、接触事件和人工接管。论文的 chunk 长度属于其设备、数据和控制频率，不能原样搬到另一台机器人。

## Temporal ensemble 在融合什么

滚动预测会让多个 chunk 覆盖同一个未来时刻。Temporal ensemble 可以对这些预测加权，降低某一次输出的抖动。它也会引入新的参数：使用多少历史预测、权重如何衰减、场景变化后何时清空旧计划。

接触任务中，如果力传感器触发或目标突然移动，应有明确的计划失效条件。继续平均旧预测可能比立即重新规划更危险。

## ALOHA 的硬件意义

ALOHA 关注低成本双臂示教和真实操作数据采集。它提醒我们，模仿学习效果不只取决于网络结构，遥操作手感、相机位置、时间同步和示教一致性都会进入数据。重复采集同一个错误动作，模型会忠实地学会错误。

一份训练记录至少应包含：

```json
{
  "robot": "target hardware revision",
  "cameras": ["front", "wrist_left", "wrist_right"],
  "control_hz": 0,
  "chunk_size": 0,
  "dataset_version": "commit-or-manifest",
  "failed_demonstrations_removed": false
}
```

示例中的零值表示必须用真实配置填写，不能作为推荐参数。

## 和 Diffusion Policy、VLA 的关系

ACT 与 Diffusion Policy 都能输出一段动作，但建模方式不同；VLA 又把语言和视觉语义带进动作生成。选择方法时先看任务：固定双臂装配可能更关心精确示教和动作 chunk，开放物体语义任务才需要更强语言泛化。

论文比较要对齐数据、机器人、任务和评测协议。某篇论文在自己的基准上领先，不代表它在你的相机、控制频率和接触条件下仍然领先。

## 把论文方法变成自己的最小实验

不需要一开始复现整套双臂平台。可以先用已有示教数据做三组离线比较：单步预测、短 chunk、较长 chunk。三组使用相同训练集、随机种子和评测片段，记录动作误差、推理时间、chunk 切换处的速度突变和滚动执行后的累计偏差。

| 实验变量 | 固定内容 | 需要记录 |
| --- | --- | --- |
| chunk size | 数据、网络规模、训练步数 | 动作误差、推理延迟 |
| temporal ensemble | 同一组模型输出 | 抖动、响应新观测的时间 |
| 示教质量 | 模型和超参数 | 失败示教比例、任务成功率 |
| 控制频率 | 同一任务与硬件 | 结果年龄、deadline miss |

离线动作误差下降后，再进入限速真机测试。真机阶段要增加急停、人工接管、接触异常和计划过期记录，不能只重放论文里的成功片段。

## 参考资料

- [Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware](https://arxiv.org/abs/2304.13705)
- [ALOHA project](https://tonyzhaozh.github.io/aloha/)
- [Diffusion Policy](https://arxiv.org/abs/2303.04137)
- [VLA 论文导读](/2026/03/10/vla-paper-reading-guide/)

**证据边界：**本文概括 ACT/ALOHA 论文公开方法和可迁移的工程问题，没有复现论文实验，也没有给出 chunk size、成功率或双臂硬件结果。论文结果不能直接当作本网站或用户机器人的实测结论。
