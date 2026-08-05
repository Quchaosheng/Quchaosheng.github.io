---
title: STOP 的 ACK 为什么不能和业务命令的 ACK 混在一起
date: 2026-08-12 09:30:00
allow_future: true
permalink: /2026/08/12/stop-ack-command-id-namespace/
categories: [技术, 机器人系统]
tags: [CAN, ROS 2, 协议, ACK, 安全停车]
---

我排查取消后的偶发 ACK 异常时，最危险的假设是“收到一条格式正确的响应，就可以结束当前等待”。STOP 也是 CAN 命令，也会产生 ACK。如果 STOP 与业务命令复用 command-id，迟到的 STOP ACK 可能进入下一次业务等待窗口，被解释成“设备确认执行业务”。

这类错误不会总是表现为超时。它可能让任务更快成功，因此比明显失败更难发现。

<div class="note-flow"><span>发送业务命令</span><i>→</i><span>触发安全停车</span><i>→</i><span>分配 0x8000+ ID</span><i>→</i><span>按 expected ID 过滤</span></div>

<figure class="note-visual"><figcaption><span>两套相关性约束</span>命名空间避免合法 ID 重叠，等待上下文避免迟到帧污染当前请求。</figcaption><div class="note-map"><span><b>业务</b><small>1 到 0x7FFF。</small></span><span><b>STOP</b><small>0x8000 到 0xFFFF。</small></span><span><b>expected ID</b><small>每次等待绑定一个关联键。</small></span><span><b>忽略</b><small>不匹配响应不结束等待。</small></span></div></figure>

## 协议已经冻结，怎么加相关性

当前协议没有再增加一个响应类型字段，而是划分 command-id 空间：

```text
0x0001..0x7FFF  application command
0x8000..0xFFFF  STOP command
```

普通业务 ID 超过 `0x7FFF` 后回绕到 1。STOP ID 从 `0x8000` 开始，在 `uint16_t` 上限后回绕到 `0x8000`。两个分配器不会合法地产生相同 ID。

```bash
rg -n "kApplicationCommandIdMax|kStopCommandIdMin|kStopOpcode" ros2_ws/src/runtime_can
rg -n "allocate_command_id|allocate_stop_command_id" \
  ros2_ws/src/task_executor/src ros2_ws/src/device_bridge/src
```

只划分空间仍然不够。接收端的 `receive_response()` 必须绑定本次等待的 `expected_command_id`。帧能解码，不代表它属于当前请求。ID 不匹配时，代码记录 `Ignoring unmatched response` 并继续等待。

## safe_stop_sent 阶段的自干扰

我把“STOP 已发送，正在等待或清理其响应”的阶段称为 `safe_stop_sent`。这是排障时使用的阶段标签，不是源码变量名。

进入这个阶段后，匹配当前 STOP ID，且设备模式为 `STOPPED` 的响应才能完成 STOP。其他 ACK 即使格式正确也要忽略。STOP 窗口结束后，迟到的 `0x8000+` 响应若进入业务窗口，仍会因为 ID 不匹配被丢开。

这解决了一个自干扰问题：系统自己发出的安全停车帧及其响应不能被算成“意外业务 ACK”。否则安全动作会污染后续故障判断。

## 我怎样验证线上没有串线

协议单测先锁住命名空间边界：

```bash
colcon test --packages-select runtime_can device_bridge
colcon test-result --verbose
```

E2E 使用 `candump -L vcan0` 保存 `0x100` 命令帧和 `0x101` 响应帧。`assert_stop_can` 从 opcode `0xFF` 的命令中提取 STOP ID，再要求响应 command-id 与它一致。

`cancel` 场景要求恰有一条 STOP 响应，设备模式为 `STOPPED`。`drop_stop_ack` 场景要求没有对应响应，并得到 `SAFE_STOP/204`。`ack_timeout` 场景还检查业务 ACK 超时后发送 STOP，最终保留原业务故障 `201`，同时确认 STOP 已被设备应答。

日志中还有两条值得保留：

```text
STOP sent stop_command_id=... original_command_id=...
Ignoring unmatched response ... expected=...
```

前者证明 STOP 没有复用业务 ID，后者证明迟到帧不能抢占当前等待。实现与完整说明可在 [Embodied Agent Runtime 提交 01960cd](https://github.com/Quchaosheng/embodied-agent-runtime/commit/01960cd2d1cd40c146d2b58301be34a00a13a8d6) 中复核。

**证据边界：**这些结果证明软件接收端按 expected ID 过滤，以及 vcan 场景中的帧与 Action 结果一致。它不能证明真实控制器不会重排、重复或缓存帧。STOP ACK 也不等同于执行器失能或硬件急停动作。
