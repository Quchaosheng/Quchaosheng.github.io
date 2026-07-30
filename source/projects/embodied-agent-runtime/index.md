---
title: Embodied Agent Runtime
date: 2026-07-30 16:00:00
layout: page
description: 受任务契约约束的 AI 到 ROS 2 Action、SocketCAN 与运行时历史链路。
cover: /image/projects/embodied-runtime.jpg
---

<div class="page-lead"><p class="section-kicker">项目说明</p><p>Embodied Agent Runtime 把规则、模型输出和相机触发器接进 ROS 2 的任务流程。它们只能申请已有的工作流，不能直接往 CAN 总线发命令；任务会经过固定的 BehaviorTree、ROS 2 Action、设备桥和历史记录。</p></div>

<figure class="project-hero-image"><img src="/image/projects/embodied-runtime.jpg" alt="Embodied Agent Runtime 的 X5 相机和 ArUco 识别演示"></figure>

<div class="project-facts"><div><span>目标平台</span><strong>x86_64 / ARM64 · ROS 2 Jazzy / Humble</strong></div><div><span>控制边界</span><strong>allowlist workflow · 固定 BehaviorTree</strong></div><div><span>实体证据</span><strong>X5 · USB 相机 · ArUco · 双 CANable</strong></div></div>

## 模型不能直接发 CAN

<div class="note-flow"><span>规则 / 模型文本<br>视觉触发</span><i>→</i><span>ExecuteWorkflow<br>允许列表与身份</span><i>→</i><span>固定 BehaviorTree<br>嵌套 ROS 2 Action</span><i>→</i><span>Device Bridge<br>截止期与诊断</span><i>→</i><span>SocketCAN<br>设备或虚拟设备</span></div>

模型或感知适配器只能提交允许的工作流，不能直接写 CAN 帧。每个任务都会检查目标、截止时间、取消和停止条件，并把结果写进历史记录。

## 代码里有什么

<div class="note-map"><span><b>任务接口</b><small>ROS 2 Action、消息和服务描述任务输入与结束状态。</small></span><span><b>设备桥</b><small>处理 SocketCAN 发送、ACK、重试、停止、取消和诊断。</small></span><span><b>任务执行器</b><small>检查允许列表和截止时间，再调用嵌套 Action。</small></span><span><b>工作流</b><small>使用固定的 BehaviorTree.CPP 图，不让模型临时生成控制流程。</small></span><span><b>历史记录</b><small>SQLite 保存任务记录、查询结果和延迟统计。</small></span><span><b>输入适配器</b><small>规则、可选模型接口和 ArUco/USB 相机都在任务入口外侧。</small></span></div>

## 先跑一次

Windows 主机可先用 WSL2 脚本检查或构建测试环境；原生 Linux 则在对应 ROS 2 发行版下完成依赖解析、构建和测试。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\windows_wsl.ps1 -Mode Check

powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\windows_wsl.ps1 -Mode BuildTest
```

运行时把 ROS 2 日志、网关记录和 SQLite 历史一起保留。一次“任务完成”不能说明设备真的完成了物理动作。

## 当前跑过什么

- 仓库里有工作流、Action、SocketCAN、诊断、历史、虚拟设备和端到端测试。
- 跑过 X5/ARM64 构建与 smoke、USB 相机 ArUco 检测，以及两只 CANable 的双向经典 CAN 台架。
- CAN ACK 只表示协议响应，不表示执行器已经运动。这个项目没有验证真实电机负载、硬件急停电路、DDS 安全或 CAN 总线认证。

接上执行器后，还要单独测试安全链路和闭环反馈。

**链接：** [GitHub 源码与运行说明](https://github.com/Quchaosheng/embodied-agent-runtime) · [项目总览](/projects/)
