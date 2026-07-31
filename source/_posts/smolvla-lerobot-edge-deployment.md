---
title: SmolVLA 与 LeRobot：小模型怎样用异步推理跟上机器人
date: 2026-08-31 09:30:00
allow_future: true
source_published_at: 2025-06-02
permalink: /2026/08/31/smolvla-lerobot-edge-deployment/
categories: [技术, AI机器人]
tags: [SmolVLA, LeRobot, VLA, 异步推理, 边缘部署]
---

实验台上的机械臂通常等得起模型，真实任务不会。推理偶尔慢 80 ms，控制线程如果跟着停 80 ms，夹爪会在半空顿一下；控制线程如果继续消费旧动作，机器人又可能对着几帧前的位置运动。SmolVLA 的“小”固然吸引人，它更值得读的部分却是异步推理：感知与动作生成一条线程，动作执行另一条线程，两边通过带时间含义的 chunk 协作。

<div class="note-flow"><span>控制线程消费当前动作队列</span><i>→</i><span>剩余动作低于水位</span><i>→</i><span>提交最新观测做异步推理</span><i>→</i><span>校验并合并新 chunk</span><i>→</i><span>过期或不连续则拒绝</span></div>

<figure class="note-visual"><figcaption><span>异步运行图</span>模型跑得快只是起点，队列还要回答动作属于哪一帧、何时失效、怎样替换。</figcaption><div class="note-map"><span><b>SmolVLM 骨干</b><small>处理多图像和语言条件，规模小于常见十亿级 VLA。</small></span><span><b>Action expert</b><small>用 flow matching 生成连续动作 chunk。</small></span><span><b>推理生产者</b><small>读取最新观测，在独立线程或进程中生成下一段动作。</small></span><span><b>控制消费者</b><small>按固定周期取动作，不等待一次完整视觉推理。</small></span><span><b>水位与版本</b><small>决定何时预取，以及新 chunk 能否覆盖旧计划。</small></span><span><b>保护层</b><small>过期、跳变、越界和通信丢失时减速或停车。</small></span></div></figure>

## 450M 参数改变了试验门槛

SmolVLA 论文描述的主模型约 4.5 亿参数，其中 action expert 约 1 亿参数。视觉语言部分采用 SmolVLM-2，并在实现中截取部分语言模型层；动作分支使用 flow matching，论文设置中以 10 个推理步生成 chunk。作者把模型设计成单 GPU 可训练，也讨论了消费级 GPU 和 CPU 部署。

这些数字不能直接换算成某台电脑的帧率。参数量只影响一部分成本，图像分辨率、相机数量、注意力缓存、dtype、动作长度和 Python 调度都会进入结果。CPU 能加载模型，也不等于 CPU 能在动作过期前持续生成新 chunk。

一个更有用的初测表是：

| 项目 | 要测的量 | 为什么 |
| --- | --- | --- |
| 冷启动 | 首次加载和首次推理时间 | 模型升级、进程重启会经过这条路径 |
| 稳态推理 | P50、P95、P99 | 平均值看不见控制停顿 |
| 输入年龄 | 推理开始时图像已经多旧 | 队列拥塞可能比模型本身更慢 |
| chunk 覆盖 | 一段动作可供控制多久 | 决定允许多大的推理抖动 |
| 内存峰值 | 加载、warmup、推理峰值 | 防止边缘设备被 OOM killer 终止 |
| 热稳定 | 运行 30 分钟后的频率和温度 | 小模型也会被功耗墙限速 |

这张表和[Jetson 机器人部署](/2026/07/30/jetson-robot-deployment/)里的功耗、CPU/GPU 分工可以直接拼在一起。

## 异步推理不是多开一个线程

设控制频率为 20 Hz，每个动作点覆盖 50 ms。模型一次生成 16 步，理论上覆盖 800 ms。控制器执行 4 步后就请求新 chunk，推理器最多有约 200 ms 准备时间吗？不一定。新推理读取的图像、GPU 排队、序列化和网络往返都会吃掉预算，而且当前 chunk 继续执行时，场景还在变化。

异步接口至少要携带这些字段：

```text
request:  episode_id, observation_seq, captured_at, state, state_schema
response: episode_id, observation_seq, model_version, created_at,
          action_schema, dt, actions[], valid_for_ms
```

`observation_seq` 用来判断响应对应哪一帧，`episode_id` 防止上一个任务的迟到结果进入新任务，`model_version` 让录包能还原模型，`dt` 说明动作点之间的时间间隔。只有 `actions[]` 的接口调通很快，出问题后几乎没法审计。

## 新旧 chunk 怎么接

最简单的策略是新 chunk 到达后立刻替换旧队列。这会产生跳变：新模型看到的是较晚的状态，它预测的第一个动作未必与旧队列正在执行的动作连续。另一种策略是等旧 chunk 用完再切换，动作更连贯，却可能执行过时计划。

工程上常在三种做法里选择：

1. 每个 chunk 只执行前 `k` 步，新响应到达后丢弃旧尾部。
2. 在短重叠窗口内对新旧动作加权，但仍做速度与加速度检查。
3. 让模型输出目标或短轨迹，由下层 MPC/轨迹控制器保证连续性。

第三种边界更清楚，但会改变论文策略的实际执行方式。比较结果时要把这层控制器写进实验配置，不能仍把结果记成“模型原始成功率”。

下面的队列示例演示版本和过期检查。它是可运行的调度骨架，不连接真机：

```python
from collections import deque
from dataclasses import dataclass
from time import monotonic

@dataclass
class Chunk:
    episode: int
    observation_seq: int
    created_s: float
    dt_s: float
    actions: list[tuple[float, ...]]

queue = deque()
current_episode = 3
latest_observation = 41

def accept(chunk: Chunk, max_lag_frames: int = 2) -> bool:
    if chunk.episode != current_episode:
        return False
    if latest_observation - chunk.observation_seq > max_lag_frames:
        return False
    if monotonic() - chunk.created_s > chunk.dt_s * len(chunk.actions):
        return False
    queue.clear()
    queue.extend(chunk.actions)
    return True

candidate = Chunk(3, 40, monotonic(), 0.05, [(0.0,) * 7 for _ in range(8)])
print("accepted:", accept(candidate), "queued:", len(queue))
```

真机版本不能在高优先级控制线程里随意分配 Python 对象。可以让非实时进程完成推理和校验，再通过固定容量共享内存把动作交给 C++ 控制循环；控制循环只做有界读取、限幅和看门狗。

## 数据小并不表示数据接口可以随意

论文说明其训练数据约 2.3 万条轨迹，少于许多大 VLA 使用的数据规模。SmolVLA 借助社区可采集的低成本机器人数据降低进入门槛，但不同人的相机安装、夹爪方向、动作单位和示教质量更不统一。

LeRobot 数据集至少要固定 feature schema、时间戳、episode 边界和任务描述。合并数据前先检查：

```bash
python -m pip install "lerobot[smolvla]"
python -c "import lerobot, torch; print('lerobot', lerobot.__version__); print('torch', torch.__version__); print('cuda', torch.cuda.is_available())"
```

安装命令会随 LeRobot 版本变化，实际训练前应锁定仓库提交或包版本，并按对应文档准备环境。模型训练日志也要记录数据集 revision，不能只记 Hugging Face 仓库名。

## 本地推理和远程推理的边界

小模型让本地部署更现实。本地的优势是输入不出设备、网络抖动较少，断网后仍可运行；代价是显存、温度和电池都由机器人承担。远程 GPU 算得更快，却要把相机上传、编码、网络 P99 和断线处理放进预算。

不要用一次 `ping` 判断是否适合远程控制。至少录制请求时刻、服务开始时刻、服务完成时刻和动作实际执行时刻。网络断开后，控制器应在当前 chunk 的有效期结束前进入确定状态，不能一直重复最后一个动作。

SmolVLA 的价值并不是证明“小模型已经足够”。它提供了一条能自己动手检查的路线：用开放代码、社区数据和较低硬件门槛，把 VLA 的动作接口、队列和延迟真正跑起来。模型效果和系统可控性仍要分别验收。

## 参考资料

- [SmolVLA: A Vision-Language-Action Model for Affordable and Efficient Robotics](https://arxiv.org/abs/2506.01844)
- [Hugging Face LeRobot repository](https://github.com/huggingface/lerobot)
- [π0: A Vision-Language-Action Flow Model](https://arxiv.org/abs/2410.24164)

## 证据边界

450M、action expert 规模、10 步 flow matching、单 GPU 训练定位和论文比较均来自 SmolVLA 论文，本站没有复现其 benchmark。队列协议与 Python 代码是面向工程接口的示例，不是 LeRobot 官方运行时，也没有实时性保证。CPU、Jetson 或消费级 GPU 是否够用，必须在目标相机数量、动作频率和热环境下测量。
