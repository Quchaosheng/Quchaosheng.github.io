---
title: Embodied Agent Runtime
date: 2026-07-30 16:00:00
layout: page
description: 受任务契约约束的 AI 到 ROS 2 Action、SocketCAN 与运行时历史链路。
cover: /image/projects/embodied-runtime.jpg
---

<div class="page-lead"><p class="section-kicker">PROJECT DOSSIER</p><p>Embodied Agent Runtime 把规则、模型文本和视觉触发器限制在可审查的工作流入口之后：固定的 BehaviorTree.CPP 编排、嵌套 ROS 2 Action、SocketCAN 设备桥和 SQLite 任务历史共同组成一条可诊断的任务路径。</p></div>

<figure class="project-hero-image"><img src="/image/projects/embodied-runtime.jpg" alt="Embodied Agent Runtime 的 X5 相机和 ArUco 识别演示"></figure>

<div class="project-facts"><div><span>目标平台</span><strong>x86_64 / ARM64 · ROS 2 Jazzy / Humble</strong></div><div><span>控制边界</span><strong>allowlist workflow · 固定 BehaviorTree</strong></div><div><span>实体证据</span><strong>X5 · USB 相机 · ArUco · 双 CANable</strong></div></div>

## 任务不会绕过控制链

<div class="note-flow"><span>规则 / 模型文本<br>视觉触发</span><i>→</i><span>ExecuteWorkflow<br>允许列表与身份</span><i>→</i><span>固定 BehaviorTree<br>嵌套 ROS 2 Action</span><i>→</i><span>Device Bridge<br>截止期与诊断</span><i>→</i><span>SocketCAN<br>设备或虚拟设备</span></div>

模型或感知适配器只能提交受限的工作流；它们不能直接写 CAN 帧。这样做不是为了假装模型永远正确，而是让每个动作都经过目标验证、deadline、取消、停止和历史记录等统一路径。

## 公开实现范围

<div class="note-map"><span><b>任务接口</b><small>ROS 2 Action、消息与服务契约描述任务的输入和结束状态。</small></span><span><b>设备桥</b><small>处理 SocketCAN 发送、ACK、重试、STOP、取消与运行时诊断。</small></span><span><b>任务执行器</b><small>执行目标 allowlist、deadline 预算与嵌套 Action，输出 TaskEvent。</small></span><span><b>工作流编排</b><small>使用固定 BehaviorTree.CPP 图，避免模型在运行时生成不可审查控制流。</small></span><span><b>历史与统计</b><small>SQLite 保留任务记录、查询与延迟分位统计，便于回放与排障。</small></span><span><b>适配器</b><small>规则规划、可选模型接口和 ArUco/USB 相机触发器都在任务边界外侧。</small></span></div>

## 最小软件路径

Windows 主机可先用 WSL2 脚本检查或构建测试环境；原生 Linux 则在对应 ROS 2 发行版下完成依赖解析、构建和测试。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\windows_wsl.ps1 -Mode Check

powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\windows_wsl.ps1 -Mode BuildTest
```

运行的工件、ROS 2 日志、网关记录和 SQLite 历史应一起保留；单次“任务完成”不足以说明设备侧的物理动作正确。

## 已验证与不能外推的部分

- **公开的软件路径：** 工作流、Action、SocketCAN、诊断、历史、虚拟设备和端到端测试路径均在仓库中实现并持续测试。
- **实体台架：** 仓库记录了 X5/ARM64 构建与 smoke、USB 相机 ArUco 检测，以及两只 CANable 的双向经典 CAN 台架链路。
- **不能外推：** CAN ACK 是协议响应，不等于执行器已运动；该项目不声称完成真实电机负载、硬件急停电路、DDS 安全或 CAN 总线认证。

下一步应以执行器、安全链路和闭环反馈为独立实验对象，并用[实验记录模板](/evidence/template/)保存环境、命令、原始工件和结论范围。

**入口：** [GitHub 源码与运行说明](https://github.com/Quchaosheng/embodied-agent-runtime) · [证据日志](/evidence/) · [项目总览](/projects/)
