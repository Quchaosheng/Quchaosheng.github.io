---
title: ros2_control 硬件接口的生命周期与实时性约束：read/write 里不能做的事，以及 watchdog 该放在哪一层
date: 2026-09-12 09:30:00
allow_future: true
permalink: /2026/09/12/ros2-control-hardware-interface-deadlines/
categories: [技术, ROS 2]
tags: [ros2_control, SocketCAN, 实时性, watchdog]
---

一个 ros2_control 硬件插件最容易被写成“把 CAN 帧发出去，再把反馈填回来”。真正难的是把生命周期、控制线程和故障恢复分开。我的 vcan DiffBot demo 使用 `SystemInterface`，同时保留了虚拟电机、原始 CAN 字节验证和故障注入，因此可以把接口边界讲得比一张 API 列表更具体。

这篇文章先限定范围：当前仓库验证的是软件协议、vcan 和 SocketCAN 路径，不是实际电机、ECU HIL 或生产安全认证。代码里的 deadline 和 safe-stop 设计可以被测试，但不能自动推导出真实执行器的安全性能。

<div class="note-flow"><span>on_init 校验参数</span><i>→</i><span>activate 建立通信</span><i>→</i><span>read 收反馈</span><i>→</i><span>write 发命令</span><i>→</i><span>deadline 触发 safe-stop</span><i>→</i><span>deactivate 清理</span></div>

<figure class="note-visual"><figcaption><span>三个 deadline 不是一个概念</span>设备侧 watchdog、主机侧 ACK deadline 和反馈 deadline 分别约束不同的失效路径。</figcaption><div class="note-map"><span><b>command watchdog</b><small>命令帧携带的设备侧周期，主机失联时由设备停机。</small></span><span><b>ack timeout</b><small>主机等待匹配业务 ACK 的上限，防止命令悬挂。</small></span><span><b>feedback timeout</b><small>主机等待有效反馈的上限，防止设备或总线失能被当成正常。</small></span><span><b>safe-stop</b><small>故障状态进入后有界发送停止帧，并锁存诊断状态。</small></span><span><b>read</b><small>收取有限数量的帧，更新状态和健康判断。</small></span><span><b>write</b><small>发送当前命令并登记序号，不能把 send 成功当成执行完成。</small></span></div></figure>

## 六个生命周期回调各自负责什么

`on_init` 是拒绝非法配置的地方。这里应检查硬件信息、接口数量、命令接口和参数范围，而不是等到第一次 `write` 才发现配置不完整。vcan 插件要求恰好一个 velocity 命令接口，并解析节点 ID、编码器比例和三个时间参数。参数错误时返回 `ERROR`，比让控制线程带着半初始化状态运行更容易诊断。

`export_state_interfaces` 和 `export_command_interfaces` 只负责把 ros2_control 的资源暴露给 controller_manager。它们不应该偷偷打开 CAN socket，也不应该在导出接口时启动后台线程。`on_activate` 才是建立运行期通信、清理旧故障和准备初始状态的边界；如果设备不可用，激活失败而不是假装已经 ready。

`read` 和 `write` 位于控制循环中，职责必须窄。`read` 收取本周期可处理的反馈，更新编码器和速度，检查 ACK、反馈和 CAN 错误；当前实现把每周期接收数量限制在 64 帧，避免异常流量让一次控制周期无限延长。`write` 根据最新命令构造帧，登记序号和等待的 ACK，再把帧送入 SocketCAN。

这两个函数不适合做文件 I/O、无界等待或阻塞式日志。诊断发布使用 `RealtimePublisher::trylock()`，拿不到锁时跳过这一次发布而不是让控制线程等待。这里的“实时友好”只是代码结构上的约束，不代表已经测得某个固定抖动上界；要做实时结论仍然需要明确平台、负载和测量数据。

`on_deactivate` 负责停止继续发送、尝试安全停车并关闭运行期资源。故障态一旦锁存，恢复策略必须明确：是允许重新激活，还是要求人工清除故障。把故障变量简单清零会让上层误以为设备已经恢复，反而掩盖真正的问题。

## 两个 watchdog 和一个 ACK deadline

第一个是 `command_watchdog_ms`。它随命令帧发送，由电机或虚拟电机使用。控制器如果崩溃、网络断开或不再发送新命令，设备侧 watchdog 到期后可以停止。这个 deadline 的责任方是设备侧，保护对象是“上位机失联时不要继续沿用旧速度”。

第二个是 `feedback_timeout_ms`。它在主机侧判断某个电机是否还在返回有效反馈。反馈停止可能意味着设备失能、总线故障或节点 ID 配错，主机不能继续派发普通速度命令。它保护的是控制器对设备健康状态的判断。

第三个是独立的 `ack_timeout_ms`。主机发送一个带序号的业务命令后，必须在这个时间内收到匹配 ACK；超时就进入故障路径并触发有界 safe-stop。它和 command watchdog 的时钟起点、观察对象和恢复责任方都不同，不能再把 ACK timeout 静默别名成 command watchdog。当前默认值只是配置默认值，不是对所有电机和总线都正确的经验常数。

## send 成功不等于命令执行

SocketCAN 的 `send()` 成功，最多说明帧进入了内核发送路径。CAN 层的总线 ACK 也不等于应用设备已经解析并执行命令。业务层还需要检查 command ID、序号和 result code。vcan 插件把新命令置于等待匹配 ACK 的状态，只有业务 ACK 成功才会更新完成状态；安全停车帧则登记到健康状态中，避免把自己发送的停止帧误判成一条意外反馈。

这个分层对测试很重要。ACK 丢失测试不是只检查一个错误字符串，而是注入丢 ACK，等待硬件进入 safe-stop，再从原始 CAN socket 解码停车帧。测试关心停车帧数量的上界，因为上界能发现重试风暴；“至少发过一帧”并不能证明恢复是有界的。

## 什么时候应该拒绝更复杂的实时设计

如果 `read` 里需要等待一个永远不确定的设备响应，或者 `write` 里要动态分配大量对象、等待互斥锁、同步写磁盘，接口就已经越过了控制循环的职责边界。可以把工作拆到独立线程，但必须定义有界队列、丢弃策略、时间戳和故障传播规则，不能用线程数量掩盖无限等待。

同样，增加一个 watchdog 不能代替完整的状态机。设备侧 watchdog、主机侧 ACK timeout、反馈 timeout 和 safe-stop 之间要能从诊断中区分，否则故障虽然停下来了，复盘时却不知道是命令悬挂、反馈消失还是总线错误。

这个 demo 最有价值的地方不是“模拟了一个电机”，而是把接口生命周期、业务 ACK 和故障传播放在了可测试的边界里。它仍然是软件与 vcan 证据；要声称真实电机行为，还需要真实控制器、物理 CAN、故障注入和独立的安全验收。
