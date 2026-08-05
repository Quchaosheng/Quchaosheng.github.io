---
title: 父子超时预算错配：一次 113 覆盖 204 的排障记录
date: 2026-08-07 09:30:00
allow_future: true
permalink: /2026/08/07/parent-child-timeout-budget-error-code/
categories: [技术, 机器人系统]
tags: [ROS 2, Action, 超时, CAN, 排障]
---

我在一轮取消链路回归里遇到过一个很像调度抖动的问题。同一个故障注入场景，有时返回父层的 `SAFE_STOP/113`，有时返回设备层的 `SAFE_STOP/204`。设备层明明已经进入 STOP 流程，最终错误码却不稳定。

当时父任务的取消确认预算和子任务的 STOP ACK 等待预算都配置为 `500ms`。两个计时器几乎同时起跑，谁先到期，谁就更可能决定最终 Action result。父层先结束时，它只能报告“取消未确认”，也就是 `113`。稍后设备层形成的 STOP 超时 `204` 已经没有机会成为最终结果。

<div class="note-flow"><span>复现 113/204 差异</span><i>→</i><span>对照 Action 时间线</span><i>→</i><span>核对 CAN 帧</span><i>→</i><span>拆分父子预算</span></div>

<figure class="note-visual"><figcaption><span>错误码归属</span>父层 113 是观察窗口到期，子层 204 是 STOP ACK 等待到期。</figcaption><div class="note-map"><span><b>父任务</b><small>取消请求、状态传播和结果回传。</small></span><span><b>设备层</b><small>发送 STOP 并等待响应。</small></span><span><b>时间戳</b><small>确定哪个终态先形成。</small></span><span><b>CAN 帧</b><small>确认 STOP 是否发出及响应是否存在。</small></span></div></figure>

## 为什么我不再把它归因于抖动

我先沿 Action 层级核对错误码归属：

```bash
rg -n "cancel_timeout_ms|kErrorCancelUnconfirmed" ros2_ws/src/task_executor
rg -n "stop_timeout_ms|kErrorStopTimeout" ros2_ws/src/device_bridge
rg -n "error_code, 113|SAFE_STOP 2 204|assert_stop_can" \
  ros2_ws/src/task_executor/test scripts/run_industrial_e2e.sh
```

`task_executor_node.cpp` 在父层取消超时后生成 `113`。只有子结果已经到达，`finish_from_child()` 才会透传子层错误码。设备桥接层则在 STOP ACK 等待超时后生成 `204`。

接下来我把三组记录放在同一条时间线上：Action result、TaskEvent 与观察器时间戳、`candump -L vcan0` 保存的 CAN 帧。结果不是随机的。返回 `113` 的运行里，父层终态总是先于子层结果；返回 `204` 时，设备层结果先完成，父层随后透传它。

CAN 帧又排除了另一个解释。脚本会检查 opcode 为 `0xFF` 的 STOP 是否发出，以及对应响应是否存在。故意丢弃 STOP ACK 时，STOP 命令仍然在线上出现，只是没有匹配响应。因此 `113` 并不说明 STOP 没发，它只说明父层没等到足以解释设备状态的结果。

## 根因是预算所有权

父层预算覆盖的不只是子层那 `500ms`。它还要容纳取消请求调度、Action 状态传播、线程轮询和子结果回传。把父子预算都设成 `500ms`，等于没有给这些步骤留任何余量。

修复后的配置是父层 `cancel_timeout = 1000ms`，子层 `stop_timeout = 500ms`。这不是硬实时承诺，而是明确结果归属：设备层先形成权威的 STOP 结果，父层再归并并发布终态。

我还同时修改了参数文件与节点内建默认值。只改启动 YAML 会让另一种启动方式退回旧预算，测试通过也不能代表部署配置正确。

## 回归不能只断言错误码

修复后的回归分成三条证据链：

```bash
colcon test --packages-select task_executor device_bridge runtime_can
./scripts/run_industrial_e2e.sh
cat /tmp/runtime-industrial-evidence/summary.tsv
```

正常取消应得到 `CANCELED/0`。丢弃 STOP ACK 时，父任务应得到子层透传的 `SAFE_STOP/204`，不能再被 `113` 覆盖。同时保存 task JSON、TaskEvent、观察时间戳与 CAN 日志，确认父层何时结束、子层返回什么、线上到底出现了哪些帧。

这次排障让我改了一个习惯：嵌套超时不能按“每层都给 500ms”来配置。上层观察窗口必须覆盖下层动作预算，以及结果传播所需的余量，否则更具体的错误会被更外层、更模糊的错误抢先覆盖。

对应实现和完整证据路径可在 [Embodied Agent Runtime 提交 01960cd](https://github.com/Quchaosheng/embodied-agent-runtime/commit/01960cd2d1cd40c146d2b58301be34a00a13a8d6) 中复核。

**证据边界：**这里的回归使用 `vcan0`、ROS 2 Action 和软件时间戳。它证明软件协议链路的终态归属，不证明真实执行器已经失能，也不代替硬件急停验收。
