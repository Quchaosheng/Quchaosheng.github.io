---
title: RoboTraceOpt
date: 2026-07-30 15:10:00
layout: page
description: 面向 ROS 2 的跨层运行时追踪、证据图诊断与受约束配置优化项目。
cover: /image/projects/robotraceopt.png
---

<div class="page-lead">
  <p class="section-kicker">PROJECT DOSSIER</p>
  <p>RoboTraceOpt 是一个面向 ROS 2 机器人的运行时分析项目：把应用事件、ROS 2 trace、Linux 调度证据和 CAN ACK 生命周期放进同一条可审计链路，再用诊断结果约束可尝试的配置优化动作。</p>
</div>

<figure class="project-hero-image"><img src="/image/projects/robotraceopt.png" alt="RoboTraceOpt GitHub 项目预览图"></figure>

<div class="project-facts">
  <div><span>目标环境</span><strong>Ubuntu 22.04 · ROS 2 Humble</strong></div>
  <div><span>运行时信号</span><strong>RuntimeEvent · tracing · eBPF · CAN</strong></div>
  <div><span>工程原则</span><strong>诊断先于调参，证据边界先于结论</strong></div>
</div>

## 它解决什么

机器人系统出现超时、抖动或 ACK 异常时，单看某个日志常常无法判断问题是在业务回调、DDS、调度、系统调用，还是总线一侧。RoboTraceOpt 将这些层的信号通过明确适配器和拓扑契约关联起来；对于证据冲突或不足的情况，诊断层会保留不确定性，而不是强行给出一个根因标签。

<div class="note-flow"><span>RuntimeEvent<br>应用事件</span><i>→</i><span>ROS 2 / eBPF / CAN<br>跨层适配</span><i>→</i><span>类型化证据图<br>保留缺失与冲突</span><i>→</i><span>可审计诊断<br>允许弃权</span><i>→</i><span>受约束试验<br>验证与回滚</span></div>

## 从信号到动作

<div class="note-map"><span><b>拓扑契约</b><small>冻结工作负载允许经过的阶段，未知工作负载不会被隐式套用。</small></span><span><b>关联决策</b><small>每个系统事件必须有明确接受、拒绝、未匹配或歧义结果。</small></span><span><b>证据图</b><small>Trace、StageWindow、ROS callback、DDS、调度和 ACK 等节点保留来源。</small></span><span><b>诊断边界</b><small>冲突或缺失证据可以得到“不足以判断”，而不是伪确定结论。</small></span><span><b>动作注册表</b><small>只能尝试与诊断原因匹配的配置动作，避免无边界盲调。</small></span><span><b>候选验证</b><small>每个候选方案都要经过验证；失败时保留离线回滚决策。</small></span></div>

## 公开实现范围

| 模块 | 当前公开内容 | 作用 |
| --- | --- | --- |
| `ros2_core/` | ROS 2 Humble 包与启动文件 | 承载三类插桩工作负载 |
| `diagnosis/` | 证据适配、关联、图构建和推断 | 将跨层信号变成可检查的关系 |
| `optimizer/` | 动作约束、搜索、目标、验证与回滚 | 将诊断限定到可复现实验动作 |
| `experiments/` | 故障目录、受控 runner、配对比较 | 组织 F1-F6 的开发实验流程 |
| `scripts/` | 构建、预检、采集、smoke 与实验入口 | 让过程可复现、可审计 |

## 最小可重复预检

下面的命令用于构建核心工作区并跑软件 smoke；它们不是性能结论，也不会替代正式测量会话。

```bash
bash scripts/build_core.sh
source ~/.cache/robotraceopt_build/install/setup.bash
bash scripts/run_smoke_workload.sh all 8
python3 -m unittest discover -s tests -q
```

在 RDK X5 上，先运行只读能力预检，再决定哪些正式 case 可以进入原生 Linux / X5 会话。预检、dry-run、WSL 和 vcan 输出会被明确标记为开发或代理证据。

## 证据边界

- **已公开的实现事实：** RuntimeEvent v2 插桩、`ros2_tracing`、eBPF 调度记录、SocketCAN/vcan ACK 生命周期适配、证据图和受约束搜索逻辑。
- **开发/代理证据：** WSL dry-run、RuntimeEvent-only 与 vcan 可用于检查链路和协议，不可宣称为正式调度归因或物理 CAN 结论。
- **正式结论所需：** 合格的原生 Linux 或 X5 测试会话、完整 artifact manifest、环境报告和冻结的实验矩阵。

项目台账会持续更新在[证据日志](/evidence/)；每条记录都会同时说明环境、可证明的内容和不能外推的部分。

## 下一次真实会话

1. 在目标平台生成能力报告，确认 ROS 2、tracing、eBPF 与实验所需条件均可用。
2. 冻结 case、数据集角色、seed 和输出目录后启动会话，避免在结果出现后更换口径。
3. 让 `artifact_manifest.json` 在成功 case 的最后写入，并为其包含的工件保留哈希与来源。
4. 将通过、失败和中断会话分别保留；新的测量尝试使用新的会话名，不覆盖旧结果。

**入口：** [GitHub 源码与运行说明](https://github.com/Quchaosheng/RoboTraceOpt) · [项目总览](/projects/) · [学习路径](/paths/)
