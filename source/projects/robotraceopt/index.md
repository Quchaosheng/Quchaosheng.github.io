---
title: RoboTraceOpt
date: 2026-07-30 15:10:00
layout: page
description: 面向 ROS 2 的跨层运行时追踪、证据准入与配对验证项目。
cover: /image/projects/robotraceopt.png
---

<div class="page-lead">
  <p class="section-kicker">项目说明</p>
  <p>RoboTraceOpt 把 ROS 2 应用、中间件与内核事件按可比身份和受控时间窗口归属到证据图；证据不足时拒绝下诊断结论。它可以帮助排查超时、抖动和 CAN ACK 问题，但不把关联结果包装成根因证明。</p>
</div>

<div class="project-facts">
  <div><span>目标环境</span><strong>Ubuntu 22.04 · ROS 2 Humble</strong></div>
  <div><span>运行时信号</span><strong>RuntimeEvent · tracing · eBPF · CAN</strong></div>
  <div><span>处理方式</span><strong>先定位，再调参数</strong></div>
</div>

## 用来查什么问题

机器人出现超时、抖动或 ACK 异常时，只看一份日志很难知道问题在业务回调、DDS、调度、系统调用还是总线。RoboTraceOpt 把这些记录按时间关联。记录对不上或不够时，它会保留“暂时无法判断”，不会硬给一个根因。

<div class="note-flow"><span>应用事件<br>RuntimeEvent</span><i>→</i><span>ROS 2 / eBPF / CAN<br>收集记录</span><i>→</i><span>按时间关联<br>留下来源</span><i>→</i><span>找可疑位置<br>允许未知</span><i>→</i><span>改一个设置<br>重新测试</span></div>

## 处理时会看什么

<div class="note-map"><span><b>运行路径</b><small>先写清某类工作负载会经过哪些阶段。</small></span><span><b>事件匹配</b><small>每条系统事件都标记为匹配、未匹配或不确定。</small></span><span><b>关联结果</b><small>Trace、回调、DDS、调度和 ACK 都保留来源。</small></span><span><b>无法判断</b><small>记录缺失或冲突时，结果会明确写成证据不足。</small></span><span><b>可改设置</b><small>只尝试与问题有关的配置项。</small></span><span><b>重新测试</b><small>每次改动都要重跑，失败时保留回滚信息。</small></span></div>

## 仓库里有什么

| 模块 | 当前公开内容 | 作用 |
| --- | --- | --- |
| `ros2_core/` | ROS 2 Humble 包与启动文件 | 承载三类插桩工作负载 |
| `diagnosis/` | 证据适配、关联、图构建和推断 | 将跨层信号变成可检查的关系 |
| `optimizer/` | 动作约束、搜索、目标、验证与回滚 | 将诊断限定到可复现实验动作 |
| `experiments/` | 故障目录、受控 runner、配对比较 | 组织 F1-F6 的开发实验流程 |
| `scripts/` | 构建、预检、采集、smoke 与实验入口 | 运行和检查这些步骤 |

## 先跑一次

下面的命令先确认核心工作区能构建、软件 smoke 能通过。性能和调度问题还要在目标环境里单独测。

```bash
bash scripts/build_core.sh
source ~/.cache/robotraceopt_build/install/setup.bash
bash scripts/run_smoke_workload.sh all 8
python3 -m unittest discover -s tests -q
```

在 RDK X5 上，先跑只读能力检查，再决定哪些测试能放到原生 Linux 或 X5 上。预检、dry-run、WSL 和 vcan 的结果只用于开发检查。

## 现在能说明什么

- 代码里有 RuntimeEvent v2 插桩、`ros2_tracing`、eBPF 调度记录、SocketCAN/vcan ACK 适配、关联和配置搜索逻辑。
- WSL dry-run、RuntimeEvent-only 和 vcan 可以检查链路和协议，不能用来说明正式调度归因或物理 CAN。
- 要下正式结论，还要有原生 Linux 或 X5 测试、环境报告和完整的输出文件。

## 真机测试还缺什么

1. 先确认目标平台上的 ROS 2、tracing 和 eBPF 都可用。
2. 开始前确定测试用例、输入、seed 和输出目录。
3. 成功时写入 `artifact_manifest.json`，保留输出文件的来源和哈希。
4. 通过、失败和中断的测试都保留；下一次测试用新的目录，不覆盖旧结果。

**入口：** [GitHub 源码与运行说明](https://github.com/Quchaosheng/RoboTraceOpt) · [项目总览](/projects/) · [学习路径](/paths/)
