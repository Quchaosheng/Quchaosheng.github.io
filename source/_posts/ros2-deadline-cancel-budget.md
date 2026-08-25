---
title: ROS 2 长任务的 deadline 与 cancel：预算要逐层传递
date: 2026-08-20 20:30:00
permalink: /2026/08/20/ros2-deadline-cancel-budget/
categories: [技术, 项目方法]
tags: [ROS 2, Action, deadline, cancel]
---

机器人任务通常不是一次函数调用，而是由规划、控制、设备通信和状态确认组成的长链路。每一层如果都有自己的超时，却不知道父任务还剩多少预算，最终就会出现上层已经放弃、下层仍在执行的“幽灵任务”。

<div class="note-flow"><span>父任务建立 deadline</span><i>→</i><span>子步骤读取剩余预算</span><i>→</i><span>超时触发取消</span><i>→</i><span>停止并确认终态</span></div>

<div class="note-map"><span><b>父任务</b><small>维护绝对 deadline</small></span><span><b>子任务</b><small>消费剩余预算</small></span><span><b>设备层</b><small>停止并确认状态</small></span></div>

## deadline 比多个 timeout 更清楚

父层记录一个基于单调时钟的绝对 deadline。每个子 Action、设备请求和重试只使用剩余时间，不重新获得完整预算。这样可以保证嵌套流程的总时长有上界，也便于在日志中解释预算消耗在哪里。

预算还应预留清理时间。如果把全部时间都给业务动作，deadline 到达后就没有时间完成取消、停止和状态确认。

## cancel 是协议，不是一个布尔值

取消请求需要向正在运行的子节点传播。节点收到 cancel 后应停止产生新动作，撤销或停止当前动作，再等待设备状态进入可接受终态。对于行为树，halt 必须触达仍处于 RUNNING 的异步节点；对 ROS 2 Action，则要区分收到取消请求、接受取消和目标真正结束。

因此，“Action 已取消”不等于“物理设备已停止”。硬件停止需要设备协议、反馈与独立安全机制共同保证。

## 故障场景要覆盖边界

测试应包含子步骤超时、取消丢失、迟到反馈、停止 ACK 缺失、进程重启和设备无响应。事件记录要保留父子任务 ID、deadline、取消原因和最终状态，避免只保存最后一行错误。

## 参考资料

- [ROS 2 Actions](https://docs.ros.org/en/jazzy/Concepts/Basic/About-Actions.html)
- [BehaviorTree.CPP asynchronous actions](https://www.behaviortree.dev/docs/4.0.2/tutorial-advanced/asynchronous_nodes/)

## 证据边界

本文只讨论任务运行时的通用结构，不包含具体任务树、设备协议、超时参数或任何生产安全承诺。
