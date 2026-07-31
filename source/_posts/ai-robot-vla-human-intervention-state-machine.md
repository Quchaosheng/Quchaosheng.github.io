---
title: VLA 规划接入机器人：动作候选、人工接管和可取消状态机
date: 2026-08-13 09:30:00
allow_future: true
permalink: /2026/08/13/ai-robot-vla-human-intervention-state-machine/
categories: [技术, AI机器人]
tags: [VLA, 具身智能, ROS 2 Actions, 安全降级]
---

把视觉语言模型接到机械臂上，演示往往很顺：给一句“把红杯子放到托盘”，模型返回一串动作，机械臂开始执行。真正接近现场后，问题变成了另一种形式。目标被遮住了，动作执行到一半有人走进来，模型给了一个格式正确但不可达的位姿，或者网络断了却没有取消正在运行的任务。

VLA 的输出不应该直接变成关节命令。中间至少需要一个任务接口，负责约束、校验、取消、人工接管和审计。ROS 2 Action 的反馈、取消和结果语义适合承载这层接口，但它本身不会替你做安全判断。

读 RT-2、Diffusion Policy、Octo 或 OpenVLA 时，可以把它们看成几种不同的动作接口设计。RT-2 把动作放进语言模型的 token 序列，Diffusion Policy 生成一段连续动作，Octo 和 OpenVLA 强调跨任务、跨传感器适配。论文里的泛化结果说明模型能提出更丰富的候选，不说明候选已经通过你的工作空间、时钟和安全约束。论文导读见[《VLA 论文怎么读》](/2026/03/10/vla-paper-reading-guide/)。

<div class="note-flow"><span>解析自然语言任务</span><i>→</i><span>生成带约束的动作候选</span><i>→</i><span>验证目标和可达性</span><i>→</i><span>执行并持续检查</span><i>→</i><span>允许取消、接管或降级</span></div>

<figure class="note-visual"><figcaption><span>任务状态图</span>模型负责提出候选，任务执行器负责决定候选是否能进入运动控制。</figcaption><div class="note-map"><span><b>Proposed</b><small>只保存模型输出和来源，不代表系统同意执行。</small></span><span><b>Validated</b><small>检查目标身份、坐标系、碰撞约束、速度和工作空间。</small></span><span><b>Executing</b><small>按阶段发送动作，记录反馈和当前步骤。</small></span><span><b>Paused</b><small>人工接管、保护区触发或传感器异常时停在可恢复状态。</small></span><span><b>Canceling</b><small>取消要有超时和确认结果，不能只把客户端按钮变灰。</small></span><span><b>Failed</b><small>记录失败原因、最后安全状态和是否允许重试。</small></span></div></figure>

## 动作候选不是命令

模型输出可以是“抓取红杯子”“移动到托盘上方”或一个带参数的技能调用。执行器应把它解析成结构化候选，例如目标 ID、参考坐标系、位置容差、速度上限、允许的重试次数和超时。文本里出现的物体名称不能直接作为数据库索引，更不能直接拼成 shell 命令或控制话题名。

候选进入执行器前，至少要检查：目标是否仍在场景中，坐标系是否存在，位姿是否在工作空间内，路径是否经过碰撞检查，速度和力限制是否符合当前工具。任何一项无法确认，都应进入 `Rejected` 或 `NeedsHuman`，而不是默认继续。

## Action 的取消需要真正改变执行状态

ROS 2 Action 客户端可以发送目标、接收反馈、请求取消并等待结果。先看接口和服务器：

```bash
ros2 action list
ros2 action info /pick_and_place
ros2 interface show example_interfaces/action/Fibonacci
```

一个完整的任务状态机应区分 `CancelRequested` 和 `Canceled`。收到取消请求只代表有人提出了取消，控制器还要确认当前轨迹已经停止或回到安全姿态。取消超时、执行器拒绝取消、网络断开和服务器重启都需要不同的结果码，不能都归为“失败”。

```text
Executing + cancel_request -> Canceling
Canceling + motion_stopped -> Canceled
Canceling + timeout       -> Faulted
Executing + guard_trip    -> Paused or SafeStop
Paused + human_resume     -> Validating
```

这是状态转移的最小示意。实际系统要补上重复请求、客户端重连、任务 ID 和幂等性。重复发送同一个“放下”动作时，执行器应该能识别是否已经完成，不能每次都重新夹取。

## 人工接管不是一个布尔开关

“人工接管=true”太粗糙。操作员可能只想调整目标、确认一次抓取，或者接手整段轨迹。接口应记录接管人、接管原因、允许的动作范围和退出条件。接管期间仍要运行碰撞监控、速度限制和急停链路，不能因为进入手动模式就绕过保护。

模型置信度也不能单独决定是否接管。目标遮挡、场景变化、时间戳过期和规划器返回的余量都应成为判断输入。可以给任务状态附上这些字段：

| 字段 | 用途 | 低值时的处理 |
| --- | --- | --- |
| `scene_age` | 判断场景是否过期 | 重新感知或暂停 |
| `target_confidence` | 选择是否需要确认 | 请求人工确认 |
| `path_clearance` | 判断规划余量 | 换路径或拒绝 |
| `action_age` | 判断模型计划是否过时 | 丢弃候选 |
| `operator_id` | 追溯接管责任 | 无身份不允许恢复 |

数值阈值必须由任务和设备验证，不能拿一个通用的 0.8 当安全线。

## Nav2 和控制器之间要有边界

移动机器人可以用 Nav2 行为树组织导航和恢复动作，机械臂则常用 ros2_control 或自定义 Action 服务执行技能。无论哪种架构，VLA 都应停留在任务层，向下发送带约束的目标。规划器和控制器要能拒绝非法目标，并向上报告具体原因，例如目标不存在、路径碰撞、控制周期超时或驱动进入 fault。

调试时同时记录 Action feedback、规划器状态、传感器时间戳和安全状态：

```bash
ros2 topic echo /pick_and_place/_action/feedback
ros2 topic echo /robot_state
ros2 topic echo /diagnostics
ros2 bag record /tf /joint_states /diagnostics /robot_state
```

不同 ROS 2 版本的 Action 内部话题名称可能变化，实际以 `ros2 action info` 输出为准。录包中如果没有任务 ID，后面很难把语言请求、动作候选和最终执行结果对应起来。

## 失败后怎样恢复

失败恢复应从状态机出发，而不是让模型再试一次。感知过期可以回到 `Reobserve`，路径碰撞可以请求新规划，夹爪接触异常可以进入 `ReleaseAndSafePose`。重复尝试前要检查现场是否改变，避免把同一个错误动作连续执行。

发布到真机前，至少做取消中断、网络断开、目标消失、人工接管、急停、服务器重启和结果重复提交测试。演示成功只说明一条路径跑通，不能证明所有状态转移都能收敛。

## 参考资料

- [ROS 2 Actions](https://docs.ros.org/en/jazzy/Concepts/Basic/About-Actions.html)
- [ROS 2 action tutorials](https://docs.ros.org/en/jazzy/Tutorials/Intermediate/Writing-an-Action-Server-Client/Cpp.html)
- [Nav2 behavior trees](https://docs.nav2.org/behavior_trees/overview/detailed_behavior_tree_walkthrough.html)
- [ROS 2 managed/lifecycle nodes](https://design.ros2.org/articles/node_lifecycle.html)
- [NVIDIA Isaac documentation](https://docs.nvidia.com/isaac/)

**证据边界：**本文给出的是任务层状态机和验证清单，没有声称某个 VLA 模型的成功率、延迟或真机安全等级。Action 取消语义、控制器停止时间和人工接管权限仍需在目标 ROS 2 发行版、规划器和硬件上实测。
