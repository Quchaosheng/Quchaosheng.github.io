---
title: ROS 2 Executor 入门：回调组为什么会让定时器迟到
date: 2026-02-17 09:30:00
permalink: /2026/02/17/ros2-executor-callback-groups-basics/
categories: [技术, AI机器人]
tags: [ROS 2, Executor, 回调组, 定时器]
---

一个 10 Hz 定时器，单独运行时很准；加上图像订阅后，控制回调偶尔晚几百毫秒。很多人第一反应是换成 `MultiThreadedExecutor`。但 Executor 只是从等待集中取出“已经准备好的回调”，回调组、线程数、互斥锁和回调本身的执行时间共同决定谁会迟到。

这篇先把 ROS 2 的基本调度模型搭起来，再看单线程、多线程和回调组的差别。它不是实时调度教程，也不会因为换了 Executor 就自动获得优先级保证。

<div class="note-flow"><span>列出节点的回调</span><i>→</i><span>划分互斥和可重入回调组</span><i>→</i><span>选择 Executor 线程数</span><i>→</i><span>测量回调执行和等待时间</span><i>→</i><span>修复阻塞与过期队列</span></div>

<figure class="note-visual"><figcaption><span>Executor 图</span>Executor 决定哪些线程可以取回调，回调组决定同组回调能否并行。</figcaption><div class="note-map"><span><b>Timer</b><small>到期后进入等待集合，不能保证立刻获得一个线程。</small></span><span><b>Subscription</b><small>消息到达后变为 ready，执行时间取决于回调内部工作。</small></span><span><b>Wait set</b><small>Executor 等待的实体集合，不等同于已经运行的任务队列。</small></span><span><b>Mutually Exclusive</b><small>同组回调不并行，适合共享状态但可能互相阻塞。</small></span><span><b>Reentrant</b><small>允许并发进入，代码必须自己保证状态和资源安全。</small></span><span><b>Worker threads</b><small>多线程 Executor 提供并发机会，不提供实时优先级顺序。</small></span></div></figure>

## 单线程 Executor 先把顺序看懂

`SingleThreadedExecutor` 只有一个线程取回调。一个图像回调里做 100 ms 的推理，期间同一个 Executor 里的定时器和状态发布都只能等。这个行为很容易复现，也适合入门时观察回调之间的阻塞关系。

```cpp
rclcpp::executors::SingleThreadedExecutor executor;
executor.add_node(node);
executor.spin();
```

命令行可以先看节点有哪些订阅、定时器和服务：

```bash
ros2 node info /controller
ros2 topic hz /camera/image_raw
ros2 topic hz /cmd_vel
```

不要用 `topic hz` 的平均频率推断定时器准时。还需要在回调入口和出口记录稳态时间，并区分“消息到达后等待多久”和“回调自己执行多久”。

## 多线程不会自动消除锁等待

`MultiThreadedExecutor` 可以让多个线程同时取回调：

```cpp
rclcpp::executors::MultiThreadedExecutor executor(
    rclcpp::ExecutorOptions(), 2);
executor.add_node(node);
executor.spin();
```

如果所有实体都在默认的互斥回调组里，很多回调仍然不能并行。如果把共享状态放到可重入组，却没有保护数据，问题会从“迟到”变成数据竞争。先画出数据所有权，再决定线程数，通常比直接把线程数调大更快找到根因。

## 回调组是并发边界，不是优先级

一个节点可以把传感器回调和控制定时器放在互斥组，把只读诊断放在可重入组。互斥组能避免同组回调同时修改状态，但它也会让一个慢回调挡住同组其他工作。可重入组允许并发进入，内部成员、缓存和消息生命周期要自己保护。

可以做一个简单的分组记录：

| 实体 | 组类型 | 共享资源 | 需要观察 |
| --- | --- | --- | --- |
| 控制定时器 | 互斥 | 当前目标、输出命令 | 执行时间和等待时间 |
| 图像订阅 | 可重入或独立组 | 图像缓存 | 队列长度和结果年龄 |
| 参数服务 | 互斥 | 配置快照 | 是否阻塞控制回调 |
| 诊断定时器 | 可重入 | 只读快照 | 是否抢占过多 CPU |

表格只是设计起点，最终要根据回调实际访问的数据来分组。

## 把阻塞工作移出控制回调

文件 I/O、网络请求、模型推理和长时间锁等待都不适合直接塞进周期控制回调。常见做法是让订阅回调把输入复制或转移到有界队列，后台线程完成重活，控制定时器只读取带时间戳的最新快照。队列满时要明确丢旧数据还是拒绝新数据，不能无限增长。

```text
sensor callback -> bounded queue -> worker/inference
control timer   -> latest validated snapshot -> command
```

这种结构仍然有等待和数据年龄，优点是可以把它们测出来。Executor 只负责调度回调，不负责替你决定旧结果是否还能用于控制。

## 验证时把回调时间线记下来

每个回调至少记录实体名、入口时间、出口时间、线程 ID、源消息时间戳和序号。用 `ros2_tracing` 或结构化日志把它们合并，再看定时器周期、回调等待和队列年龄。若只打印“回调执行完成”，无法知道它是在入口前等了，还是执行中被锁挡了。

确认是 Linux 调度和迁移造成的尖峰后，再做[线程绑核实验](/2026/02/06/linux-thread-cpu-affinity/)；需要验证周期漂移和 deadline miss 时，用[绝对唤醒控制循环](/2026/02/27/linux-periodic-control-loop-basics/)建立系统基线。三篇测的是不同层次，不应把 `MultiThreadedExecutor` 的效果写成实时调度保证。

## 参考资料

- [ROS 2 Executors](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Executors.html)
- [ROS 2 Using callback groups](https://docs.ros.org/en/jazzy/How-To-Guides/Using-callback-groups.html)
- [ROS 2 callback-group concepts](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Executors.html)
- [ROS 2 tracing](https://gitlab.com/ros-tracing/ros2_tracing)

**证据边界：**Executor 和回调组的行为受 ROS 2 发行版、RMW 实现、线程调度和回调代码影响。本文没有给出实时优先级或固定延迟保证；具体结论需要在目标节点、QoS 和负载下测量。
