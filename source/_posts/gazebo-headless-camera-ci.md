---
title: Gazebo 无显示 CI 相机 0 帧：server-only 与 headless rendering 的区别
date: 2026-08-10 22:45:00
permalink: /2026/08/10/gazebo-headless-camera-ci/
categories: [技术, ROS 2]
tags: [Gazebo, CI, 相机, headless, AprilTag]
---

Gazebo 在 CI 里正常启动，<code>/camera/camera_info</code> 也收到了一条消息，但图像计数始终是 0。第一反应通常是怀疑 ROS 2 bridge、QoS 或测试订阅器。实际问题却更靠前：仿真服务器存在，不等于相机渲染管线正在工作。

这个问题来自 [ros2-apriltag-docking-demo](https://github.com/Quchaosheng/ros2-apriltag-docking-demo) 的真实 CI 排障。最初使用 server-only 参数后，测试记录为 <code>Image messages received: 0</code>，而 CameraInfo 为 1；直接去掉 <code>-s</code> 又触发 Qt 的 <code>could not connect to display</code>。最终做法不是启动桌面 GUI，而是保留 <code>-s</code> 并增加 <code>--headless-rendering</code>。

<div class="note-flow"><span>确认仿真进程存活</span><i>→</i><span>分别统计图像与 CameraInfo</span><i>→</i><span>定位渲染路径而非只查 bridge</span><i>→</i><span>启用 headless rendering</span><i>→</i><span>核对进程与话题断言</span></div>

<figure class="note-visual"><figcaption><span>无显示相机链路</span>世界更新、传感器渲染、消息桥接和测试订阅是四个不同的故障边界。</figcaption><div class="note-map"><span><b>Server</b><small>推进物理世界和仿真时间，不保证所有渲染传感器产出图像。</small></span><span><b>Renderer</b><small>在无窗口环境创建离屏渲染上下文并生成相机帧。</small></span><span><b>Bridge</b><small>把 Gazebo transport 消息转换为 ROS 2 话题。</small></span><span><b>Subscriber</b><small>按兼容 QoS 接收图像并检查时间戳与数量。</small></span><span><b>Process</b><small>测试结束时核对目标进程状态，而非接受任意子进程退出。</small></span><span><b>Evidence</b><small>保存启动参数、消息计数、日志和通过的 CI 运行。</small></span></div></figure>

## <code>-s</code> 不是 headless rendering

Gazebo 的 <code>-s</code> 表示 server-only，目的是不启动图形客户端。它解决了“不要弹 GUI”的问题，却没有自动承诺相机传感器能够在没有显示服务器时完成渲染。相机、深度相机等传感器需要渲染后端；世界能推进、里程计能更新，也可能仍然没有图像。

<code>--headless-rendering</code> 解决的是另一件事：让渲染传感器在无窗口环境使用离屏渲染路径。这个案例最终使用的参数是：

```bash
gz sim -r -s --headless-rendering -v2 --seed 42 <world.sdf>
```

<code>-r</code> 让仿真直接运行，<code>-s</code> 保持 server-only，<code>--headless-rendering</code> 启用无显示渲染，固定 seed 则减少测试输入漂移。它们各自承担不同职责，不能因为都和“没有窗口”有关就互相替代。

## 为什么 CameraInfo 有 1 条仍然不能证明相机正常

CameraInfo 主要描述内参、畸变模型和图像尺寸。驱动或桥接层可以在初始化时发布一次这类静态信息，即使后续像素帧从未生成。因此，“CameraInfo 非空”只能证明配置链路的一部分已经建立，不能证明渲染循环持续输出。

CI 至少应该分别检查：

```bash
ros2 topic info /camera/image_raw --verbose
ros2 topic echo /camera/camera_info --once
ros2 topic hz /camera/image_raw
```

测试代码还要记录图像总数、第一帧时间、最后一帧时间和仿真时间。只检查话题名称存在也不够，bridge 可以创建话题却收不到上游消息。若订阅计数为 0，再依次核对 Gazebo 原生话题、bridge 映射与 ROS 2 QoS，能够更快确定断点。

## 去掉 <code>-s</code> 为什么会得到 Qt display 错误

删除 server-only 参数后，Gazebo 会尝试启动图形客户端。托管 CI 通常没有 X11 或 Wayland display，于是 Qt 在真正执行相机测试前就以 <code>could not connect to display</code> 退出。这条错误说明 GUI 路径依赖显示服务，并不能证明相机插件本身有问题。

用 Xvfb 包住 GUI 有时可行，但本案例并不需要操作界面，也不需要截图验证。启动虚拟桌面会增加进程、资源和故障面。对只验证传感器与控制逻辑的任务，server-only 加离屏渲染更符合测试目标。

## 不要让“某个进程退出”误伤测试

多进程 launch 测试常见另一个陷阱：监控脚本发现任意后台进程退出，就判定仿真失败。bridge、探针或清理进程可能按设计提前结束，笼统的 <code>wait -n</code> 会让日志看起来像 Gazebo 崩溃。

进程断言应该带身份和阶段。仿真启动阶段要求 Gazebo server 与必要 bridge 存活；测试运行阶段要求相机消息持续到达；清理阶段允许收到终止信号，并分别收集退出码。失败信息至少写出进程名、PID、退出码和对应日志。

```bash
if ! kill -0 "$GZ_PID" 2>/dev/null; then
  echo "Gazebo server exited before camera assertion"
  wait "$GZ_PID"
  exit $?
fi
```

这段示意只检查 Gazebo PID。真实工作流还应为 bridge 和测试节点设置各自的预期生命周期，避免把正常退出与非预期崩溃混成一个状态。

## 把修复写成可以复核的证据链

这次排障可以拆成三个相互区分的实验：

| 实验 | 观察 | 能说明什么 |
| --- | --- | --- |
| <code>-s</code> | Image 0，CameraInfo 1 | server 存活，但图像渲染链路没有产出 |
| 去掉 <code>-s</code> | Qt 无法连接 display | GUI 客户端需要当前 CI 不提供的显示服务 |
| <code>-s --headless-rendering</code> | 相机断言与工作流通过 | 该提交和 CI 环境中的离屏渲染链路可用 |

修复合入的提交是 [0c825f6](https://github.com/Quchaosheng/ros2-apriltag-docking-demo/commit/0c825f69fe7bcdbcba664c158cee41161feb12a2)，对应的 [GitHub Actions 运行 31401068673](https://github.com/Quchaosheng/ros2-apriltag-docking-demo/actions/runs/31401068673) 可查看工作流结论。将提交、参数和运行链接放在一起，比只写“已修复 CI”更容易复查。

## 进一步排查时按层缩小范围

如果增加 headless rendering 后仍是 0 帧，先确认容器中存在渲染依赖与可用后端，再检查 SDF 传感器更新率、Gazebo 原生话题和 bridge 映射。随后核对 ROS 2 订阅 QoS，尤其是 sensor data 常用的 best-effort。最后检查测试是否使用仿真时间，以及等待窗口是否覆盖第一帧初始化延迟。

不要同时改世界文件、QoS、bridge 和启动参数。每轮只改变一个边界，并保存消息计数和日志差异。这样即使最终问题来自镜像或渲染驱动，也能说明哪些路径已经被排除。

## 参考资料

- [Gazebo Sim command line](https://gazebosim.org/api/sim/8/gz_sim.html)
- [Gazebo sensors](https://gazebosim.org/docs/latest/sensors/)
- [ROS 2 QoS settings](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html)
- [ros_gz_bridge](https://github.com/gazebosim/ros_gz/tree/ros2/ros_gz_bridge)

## 证据边界

本文的现象、参数、提交和 CI 链接来自上述公开仓库。通过结果证明的是该提交在对应 GitHub Actions 环境中满足了工作流断言，不代表所有 Gazebo 版本、GPU/CPU 渲染后端或容器镜像都适用，也不证明真实相机、真实 AprilTag 检测或实体机器人对接性能。
