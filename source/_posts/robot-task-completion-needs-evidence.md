---
title: 函数返回 OK，为什么机器人任务仍然可能失败
date: 2026-08-10 22:30:00
permalink: /2026/08/10/robot-task-completion-needs-evidence/
categories: [技术, 机器人系统]
tags: [任务执行, 验证, 事件回放, 安全]
---

工具函数返回 <code>OK</code>，并不等于机器人已经完成了任务。它最多说明某一层接受了请求，或者一次调用没有在本地抛出错误。命令可能还在队列里，执行器可能没有动作，传感器也可能只看到了一个过期状态。把“调用成功”直接翻译成“任务完成”，会让一个接口层事实越过设备、环境和时间边界。

我在整理 [workbench-desk-robot](https://github.com/Quchaosheng/workbench-desk-robot) 的任务契约时，把完成判定拆成了请求、执行和验证三个阶段。当前仓库用 11 个 schema 约束输入输出，以 12 个冻结场景和 24 个扩展场景覆盖关键状态，再用五类共 50 个 golden task 检查任务语义；26 个危险请求则专门验证系统是否会拒绝不该执行的动作。这些数字描述的是仓库中的测试资产，不是现实世界里的成功率。

<div class="note-flow"><span>接收结构化请求</span><i>→</i><span>生成带关联 ID 的动作</span><i>→</i><span>记录执行事件</span><i>→</i><span>用新鲜观测验证结果</span><i>→</i><span>输出完成、失败或证据不足</span></div>

<figure class="note-visual"><figcaption><span>完成证据图</span>每一层只回答自己能够观察的问题，最终状态由可追溯事件连接起来。</figcaption><div class="note-map"><span><b>请求</b><small>参数是否完整、类型是否正确、策略是否允许执行。</small></span><span><b>受理</b><small>调度器是否接受请求并分配唯一任务 ID。</small></span><span><b>执行</b><small>命令是否送达，设备是否返回与本次请求匹配的状态。</small></span><span><b>观测</b><small>传感器结果是否足够新，是否覆盖任务的成功判据。</small></span><span><b>安全</b><small>取消、超时和危险请求是否进入可确认的停止状态。</small></span><span><b>结论</b><small>证据充分才完成；冲突则失败；缺失则标为证据不足。</small></span></div></figure>

## OK 只属于它所在的边界

一个 HTTP 200 可能表示网关收到了请求；一个 ROS 2 service response 可能表示节点完成了回调；设备 ACK 可能只表示帧被解析。它们都不能单独证明“杯子已放到目标区域”。完成判据通常还需要目标姿态、夹爪状态、观测时间和安全状态。

因此，每一层的返回值都应该带上明确语义。<code>accepted</code> 表示进入队列，<code>dispatched</code> 表示命令已发送，<code>acknowledged</code> 表示设备确认，<code>verified</code> 才表示环境观测满足任务条件。若旧接口只能返回 <code>OK</code>，至少要把它映射到其中一个阶段，而不是让调用者自行猜测。

## 完成判定需要三值逻辑

很多实现只有 <code>true</code> 和 <code>false</code>。但机器人系统还有第三种常见状态：证据不足。相机断流、TF 查询缺失或观测过期时，系统不知道动作是否完成。此时返回失败可能触发重复动作，返回成功又可能掩盖危险状态。

可以把聚合规则写成三值逻辑：

```text
verified_success      所有必要判据都有新鲜且一致的证据
verified_failure      已有证据明确违反成功或安全判据
insufficient_evidence 必要证据缺失、过期或来源不可信
```

<code>insufficient_evidence</code> 不是模糊处理。它应该附带缺少的证据、等待截止时间和已采取的安全动作。调用方据此决定重试观测、请求人工确认或保持停止，而不是盲目重放业务命令。

## 事件链比最后一行日志更可靠

只保存“task finished”无法解释是谁判定的、用了哪一帧图像，也无法区分重复回调和真正的新事件。每个任务应分配稳定的 <code>task_id</code>，每个命令还要有自己的 <code>command_id</code>。事件至少记录来源、单调时间、前序事件、状态和证据引用。

```json
{
  "task_id": "task-42",
  "event": "verification_completed",
  "command_id": "cmd-107",
  "observed_at_ns": 1842200100,
  "result": "insufficient_evidence",
  "reason": "camera_frame_too_old",
  "evidence": ["camera/status#884", "executor/events#1201"]
}
```

事件流还应支持重放。重放不是再次控制机器人，而是在隔离环境中用同一组输入重新运行判定器，检查它是否产生相同结论。涉及真实执行器时必须禁用输出或替换为模拟适配器，避免排障工具重新发送历史动作。

## 模型输出也不能越过执行边界

语言模型可以把自然语言变成结构化任务，也可以建议下一步，但不应自行声明物理任务已经完成。它看不到执行器电流、目标物姿态和急停回路，除非这些事实通过受控工具返回。工具返回也要标明时间、来源和置信边界。

危险请求更需要独立策略层。拒绝结果应在执行前产生，并留下命中的规则和规范化输入。不能先调用设备，再让模型根据结果解释“其实不该做”。仓库里的危险请求集合验证的是拒绝契约是否稳定，不代表它覆盖了所有现场危险。

## 可以落地的验收清单

| 检查项 | 合格证据 | 不足的写法 |
| --- | --- | --- |
| 请求受理 | 任务 ID、规范化参数、策略版本 | “工具调用成功” |
| 命令送达 | 命令 ID、目标设备、匹配 ACK | “没有报错” |
| 物理结果 | 新鲜传感器观测与明确阈值 | “模型认为完成” |
| 超时取消 | 停止命令、停止确认、最终设备状态 | “Future 已取消” |
| 证据缺失 | 缺失项、截止期和安全处置 | 强制转成成功或失败 |
| 事件回放 | 固定输入、版本指纹、相同判定 | 手工阅读最后一行日志 |

完成判定和验收报告是一件事的两个视角。系统内部需要阶段化状态和关联 ID，系统外部需要说明结论由哪种环境与原始记录支持。关于报告写法，可以继续看[AI 机器人验收报告怎样区分证据](/2026/08/25/ai-robot-acceptance-evidence/)；关于故障事件的保存，可以参考[rosbag2 故障回放](/2026/08/24/ai-robot-rosbag2-failure-replay/)。

## 参考资料

- [ROS 2 Actions](https://docs.ros.org/en/jazzy/Concepts/Basic/About-Actions.html)
- [ROS 2 Quality of Service settings](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html)
- [OpenTelemetry traces](https://opentelemetry.io/docs/concepts/signals/traces/)
- [workbench-desk-robot](https://github.com/Quchaosheng/workbench-desk-robot)

## 证据边界

本文讨论的是任务完成判定与事件证据的工程结构。文中的资产数量来自仓库当前内容，只能说明这些测试集合存在，不能证明真机成功率、停止距离或硬件安全等级。任何物理完成结论仍需绑定具体设备、软件版本、环境、时间和原始观测。
