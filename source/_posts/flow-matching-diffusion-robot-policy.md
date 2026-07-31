---
title: Flow Matching 与 Diffusion Policy：机器人为什么开始生成一段动作
date: 2026-09-05 09:30:00
allow_future: true
source_published_at: 2025-02-27
permalink: /2026/09/05/flow-matching-diffusion-robot-policy/
categories: [技术, AI机器人]
tags: [Flow Matching, Diffusion Policy, Action Chunking, VLA, 模仿学习]
---

抓住杯柄可以从左侧接近，也可以先绕到右侧。示教数据里两种轨迹都合理，普通 L2 回归却可能取平均，给出一条正好撞上杯子的中间路线。生成式策略处理的是这种多峰动作分布：不把所有示教压成一个均值，而是从条件分布里生成一段自洽动作。

Diffusion Policy 用迭代去噪生成动作序列，π0 一类模型则用 flow matching 学习动作空间里的向量场。两者都常与 action chunk、滚动执行配合，但训练目标、采样过程和部署时的时间预算并不相同。

<div class="note-flow"><span>图像、状态和语言形成条件</span><i>→</i><span>从随机动作 chunk 开始</span><i>→</i><span>迭代去噪或积分向量场</span><i>→</i><span>校验生成轨迹</span><i>→</i><span>执行前几步并用新观测重算</span></div>

<figure class="note-visual"><figcaption><span>动作生成图</span>模型一次生成未来动作分布，控制器只消费其中一部分，并持续保留拒绝权。</figcaption><div class="note-map"><span><b>条件输入</b><small>相机、机器人状态、任务或语言决定当前动作分布。</small></span><span><b>随机初值</b><small>从噪声出发，使同一条件下可以得到多种合理 chunk。</small></span><span><b>Diffusion</b><small>学习去噪或 score，按离散时间步逐次还原动作。</small></span><span><b>Flow matching</b><small>回归条件速度场，用 ODE 积分把噪声送到数据分布。</small></span><span><b>Receding horizon</b><small>只执行短前缀，再根据新观测更新计划。</small></span><span><b>运行约束</b><small>步数、延迟、平滑、越界和旧动作年龄共同决定能否部署。</small></span></div></figure>

## 为什么要生成 chunk，而不是下一步

单步策略每次只预测 `a_t`，下一周期再看 `o_{t+1}`。反馈很及时，但每一步的小偏差会改变下一次输入，误差容易沿时间累积。双臂穿线、折衣服等动作还依赖较长协同，仅靠当前一步很难表达“左手保持，右手继续拉”的意图。

动作 chunk 一次预测 `A_t = [a_t, ..., a_{t+H-1}]`。模型能在一个样本内表达多步协调，也能让慢速视觉推理支撑更高频的动作点。代价是后半段动作很快过时，所以常配 receding-horizon control：预测 H 步，只执行前 K 步，满足 `K < H`，然后重新观测。

这和[ACT 的动作分块](/2026/07/01/aloha-act-paper-reading/)目标相似。区别在于 ACT 直接由 CVAE/Transformer 回归 chunk，Diffusion Policy 和 flow matching 通过生成过程表示动作分布。

## Diffusion Policy 学的是逐步去噪

Diffusion Policy 把干净动作序列逐步加噪得到 `A^k`，网络在图像和状态条件下预测噪声或与 score 相关的量。推理时从高斯噪声开始，沿预设噪声日程反复去噪，最终得到动作 chunk。

简化过程可以写成：

```text
training: clean action -> add noise at step k -> predict noise
sampling: random noise -> denoise k=N...1 -> action chunk
```

论文将这一做法与视觉条件、时间序列建模和滚动控制结合，在 12 个任务、4 个机器人操作基准上报告了相对基线的平均提升。该平均值只属于论文比较，不能写成“扩散策略普遍提升 46.9%”。

扩散采样的部署代价很直白：每个去噪步都可能调用一次网络。减少步数能缩短延迟，也可能改变动作质量；换 sampler 或噪声日程同样会让训练时结论发生偏移。

## Flow matching 回归的是速度场

Flow matching 选择一条从简单噪声分布到真实数据分布的概率路径，训练网络预测路径上每一点的条件速度。以最容易理解的直线条件路径为例：

```text
A_tau = (1 - tau) * epsilon + tau * A
u_tau = A - epsilon
loss = ||v_theta(A_tau, tau, condition) - u_tau||^2
```

模型推理时从 `tau=0` 的噪声出发，求解常微分方程：

```text
dA_tau / d_tau = v_theta(A_tau, tau, condition)
```

Flow Matching 原论文讨论了更一般的概率路径，直线插值只是便于理解的一种情况。π0 把这类连续动作输出接到 VLM 与 action expert 上；动作 expert 多次更新带噪动作，VLM 提供图像和语言上下文。

“ODE”也不表示只算一次。Euler、midpoint 或更高阶求解器都需要若干函数评估。模型结构、积分步数和缓存策略一起决定实际延迟，不能只凭方法名称断言 flow matching 一定更快。

## 两种方法怎么选

| 维度 | Diffusion Policy | Flow matching 动作头 |
| --- | --- | --- |
| 训练对象 | 去噪、噪声或 score 相关目标 | 条件向量场 |
| 采样过程 | 按噪声日程逐步去噪 | 沿学习到的 ODE 积分 |
| 多峰动作 | 可以表达 | 可以表达 |
| 与 VLM 结合 | 可作为独立动作策略或动作头 | π0 等用 action expert 接入 VLM |
| 主要旋钮 | 去噪步数、schedule、horizon | 积分器、步数、路径、horizon |
| 部署风险 | 多步推理和旧 chunk | 多次函数评估和旧 chunk |

表里没有“谁更准”，因为答案依赖任务、数据、模型容量和评测协议。单一稳定任务的数据不多，Diffusion Policy 的成熟实现可能更容易起步；需要语言条件、多机器人预训练和长任务语义，VLM 加 action expert 更符合目标。最后仍要用相同数据划分、相同视觉编码预算和相同真机任务比较。

## 时间预算决定 H 和 K

假设控制频率 50 Hz，单步 20 ms；模型 P99 推理 140 ms，通信和校验再用 40 ms。若每次只执行 4 步，80 ms 后就需要新 chunk，生产者永远追不上消费者。把执行前缀改为 12 步能覆盖 240 ms，留下约 60 ms 余量，但机器人会更久地沿旧计划运动。

可以用下面的脚本做第一轮预算：

```python
control_hz = 50
chunk_steps = 32
execute_steps = 12
inference_p99_ms = 140
transport_and_guard_ms = 40

step_ms = 1000 / control_hz
chunk_ms = chunk_steps * step_ms
execute_ms = execute_steps * step_ms
producer_ms = inference_p99_ms + transport_and_guard_ms
slack_ms = execute_ms - producer_ms

print(f"chunk covers {chunk_ms:.0f} ms")
print(f"next chunk must arrive within {execute_ms:.0f} ms")
print(f"p99 scheduling slack {slack_ms:.0f} ms")
if slack_ms <= 0:
    raise SystemExit("producer cannot keep up at p99")
```

正余量只是必要条件。还要考虑相机输入年龄、GPU 与其他节点争用、模型偶发超时和动作切换连续性。H 太大增加开环尾部，K 太小又让推理器追不上，参数要通过任务速度与故障测试决定。

## 随机性需要可复现，也需要多次采样

生成策略从随机噪声出发，同一观测可能产生不同动作。评测只固定一个 seed，结果容易碰巧偏好某条轨迹；完全不记 seed，又无法回放失败。

离线评测可以对每个观测采多个 seed，记录动作范围、轨迹聚类和约束拒绝率。真机不适合为了统计直接执行所有样本，可以先用碰撞检查和仿真筛掉明显非法轨迹，再对通过的候选按固定协议抽样。运行日志应保存模型版本、seed、完整条件输入和最终被执行的 chunk。

当多种生成轨迹都能通过几何检查时，选择器还可以考虑轨迹长度、关节余量和与上一 chunk 的连续性。这个选择器会改变系统策略，也必须进入版本和验收记录。

## 未来的动作模型仍绕不开确定性底座

OpenVLA-OFT 用连续回归和并行解码缩短生成路径，π0 用 action expert 和 flow matching 把 VLM 语义接到高频 chunk，SmolVLA 又把推理与执行拆成异步线程。动作头会继续变，运行时的几个问题不会消失：动作属于哪一帧，何时过期，谁检查越界，怎样取消，模型停止响应后机器人做什么。

前两种架构可分别回看[OpenVLA-OFT](/2026/08/27/openvla-oft-action-chunk-continuous/)与[π0/π0.5](/2026/08/28/pi0-pi05-flow-action-expert/)。部署侧的队列和动作年龄见[SmolVLA 与 LeRobot](/2026/08/31/smolvla-lerobot-edge-deployment/)。把三篇连起来读，比记住“扩散”或“流匹配”哪个更新更有用。

## 参考资料

- [Diffusion Policy: Visuomotor Policy Learning via Action Diffusion](https://arxiv.org/abs/2303.04137)
- [Diffusion Policy project](https://diffusion-policy.cs.columbia.edu/)
- [Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747)
- [π0: A Vision-Language-Action Flow Model for General Robot Control](https://arxiv.org/abs/2410.24164)
- [OpenVLA-OFT](https://arxiv.org/abs/2502.19645)

## 证据边界

Diffusion Policy 的任务数量、论文平均提升和 π0 的模型设计来自原论文。本站没有在同一数据集上重训两种策略，也没有给出准确性胜负。公式省略了具体噪声日程、网络参数化、概率路径与求解器细节；时间预算脚本只做静态算术。方法选择必须在相同数据、硬件、动作空间和真机协议下比较。
