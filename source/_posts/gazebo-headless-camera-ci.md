---
title: Gazebo 无显示 CI 为何偶发超时：从相机 0 帧到 QoS 启动竞态
date: 2026-08-10 22:45:00
permalink: /2026/08/10/gazebo-headless-camera-ci/
categories: [技术, ROS 2]
tags: [Gazebo, CI, 相机, headless, AprilTag]
---

Gazebo 在 CI 里正常启动，<code>/camera/camera_info</code> 也收到了一条消息，但图像计数始终是 0。修完渲染路径后，同一套测试又出现“有时 16 秒通过，有时等满 180 秒”的现象。它们不是同一个问题：前者发生在 Gazebo 相机与 ROS 2 bridge 之间，后者是测试错过了一条 transient-local 状态消息。

这个问题来自 [ros2-apriltag-docking-demo](https://github.com/Quchaosheng/ros2-apriltag-docking-demo) 的真实 CI 排障。最初使用 server-only 参数后，测试记录为 <code>Image messages received: 0</code>，而 CameraInfo 为 1；直接去掉 <code>-s</code> 又触发 Qt 的 <code>could not connect to display</code>。增加 <code>--headless-rendering</code> 曾让一次运行通过，却不能重复。最终方案使用 Xvfb 提供显示上下文、由同一个 <code>parameter_bridge</code> 桥接图像与 CameraInfo，并让测试以匹配的 QoS 读取初始状态。

<div class="note-flow"><span>确认仿真进程存活</span><i>→</i><span>分别统计图像与 CameraInfo</span><i>→</i><span>稳定渲染与桥接路径</span><i>→</i><span>逐项记录测试判据</span><i>→</i><span>修正状态话题 QoS</span></div>

<figure class="note-visual"><figcaption><span>无显示相机链路</span>世界更新、传感器渲染、消息桥接和测试订阅是四个不同的故障边界。</figcaption><div class="note-map"><span><b>Server</b><small>推进物理世界和仿真时间，不保证所有渲染传感器产出图像。</small></span><span><b>Renderer</b><small>在无窗口环境创建离屏渲染上下文并生成相机帧。</small></span><span><b>Bridge</b><small>把 Gazebo transport 消息转换为 ROS 2 话题。</small></span><span><b>Subscriber</b><small>按兼容 QoS 接收图像并检查时间戳与数量。</small></span><span><b>Process</b><small>测试结束时核对目标进程状态，而非接受任意子进程退出。</small></span><span><b>Evidence</b><small>保存启动参数、消息计数、日志和通过的 CI 运行。</small></span></div></figure>

## <code>-s</code> 不是 headless rendering

Gazebo 的 <code>-s</code> 表示 server-only，目的是不启动图形客户端。它解决了“不要弹 GUI”的问题，却没有自动承诺相机传感器能够在没有显示服务器时完成渲染。相机、深度相机等传感器需要渲染后端；世界能推进、里程计能更新，也可能仍然没有图像。

<code>--headless-rendering</code> 解决的是另一件事：让渲染传感器在无窗口环境使用离屏渲染路径。它是需要单独验证的后端选择，不是“加上就必然稳定”的开关。这个案例验证过的离屏命令是：

```bash
gz sim -r -s --headless-rendering -v2 --seed 42 <world.sdf>
```

<code>-r</code> 让仿真直接运行，<code>-s</code> 保持 server-only，<code>--headless-rendering</code> 选择离屏渲染，固定 seed 则减少测试输入漂移。它们各自承担不同职责，不能因为都和“没有窗口”有关就互相替代。本项目后来改用 Xvfb + Ogre 的显示上下文路径，因为托管 runner 上的 Ogre2/EGL 结果不能稳定重复。

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

Xvfb 并不意味着必须启动 Gazebo GUI。最终工作流仍使用 <code>-s</code> 运行 server-only，只让 Xvfb 为相机渲染提供显示上下文。这样避开了 Qt 客户端，也避开了该 runner 上不稳定的 EGL 路径。选择 Xvfb 还是离屏渲染，应由重复运行的证据决定，而不是由“headless”这个名称决定。

## 测试通过一次，为什么仍会等满 180 秒

相机链路稳定后，手动探针已经能看到约 30 FPS 图像、AprilTag <code>id=0</code> detection 和 <code>/detected_dock_pose</code>，但 launch test 仍偶发超时。逐项检查三个完成条件后发现，缺失的是 <code>/demo2/docking_state=IDLE</code>。

状态发布者使用 reliable + transient-local QoS，在节点初始化时只发布一次 <code>IDLE</code>。测试却用默认 volatile QoS 订阅，而且测试订阅器经常晚于发布者创建。volatile 订阅器不会读取历史样本，于是这条状态永久丢失；只有测试恰好抢先完成 discovery 时才会通过。

修复不是增加 sleep，而是让订阅契约匹配发布者：

```python
state_qos = QoSProfile(
    depth=1,
    reliability=ReliabilityPolicy.RELIABLE,
    durability=DurabilityPolicy.TRANSIENT_LOCAL,
)
node.create_subscription(String, '/demo2/docking_state', on_state, state_qos)
```

这条经验适用于所有“启动时只发布一次”的状态：发布者选择 transient-local 只是第一步，晚加入的订阅者也必须请求 transient-local，才能拿到缓存样本。

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
| <code>-s --headless-rendering</code> | 一次通过，后续又出现 0 帧 | 只能证明单次运行可用，不能证明稳定 |
| Xvfb + Ogre + 单一 bridge | 图像约 30 FPS，Tag 与 pose 正常 | 渲染、桥接和检测链路可用 |
| volatile 状态订阅 | 偶发 16 秒通过或 180 秒超时 | 测试结果受 discovery 时序影响 |
| transient-local 状态订阅 | 本地 Jazzy 完整套件 89 项通过 | 初始 <code>IDLE</code> 可被晚加入测试读取 |

中间修复提交 [0c825f6](https://github.com/Quchaosheng/ros2-apriltag-docking-demo/commit/0c825f69fe7bcdbcba664c158cee41161feb12a2) 和 [GitHub Actions 运行 31401068673](https://github.com/Quchaosheng/ros2-apriltag-docking-demo/actions/runs/31401068673) 解释了为什么当时会判断“已经修好”；后续重复运行又推翻了这个结论。最终修复合入 [e5483b1](https://github.com/Quchaosheng/ros2-apriltag-docking-demo/commit/e5483b1141ce55ed78dc59b8c271ccda5210ba01)，对应的 [main 分支 CI 运行 31416156349](https://github.com/Quchaosheng/ros2-apriltag-docking-demo/actions/runs/31416156349) 完整通过。保留成功与失败证据，比只保留最后一张绿灯截图更能说明修复边界。

## 进一步排查时按层缩小范围

如果增加 headless rendering 后仍是 0 帧，先确认容器中存在渲染依赖与可用后端，再检查 SDF 传感器更新率、Gazebo 原生话题和 bridge 映射。随后核对图像 QoS，尤其是 sensor data 常用的 best-effort。若图像、detection 和 pose 都已正常，则应逐项打印测试完成条件，并检查 transient-local 状态是否被 volatile 订阅器错过。

不要同时改世界文件、QoS、bridge 和启动参数。每轮只改变一个边界，并保存消息计数和日志差异。这样即使最终问题来自镜像或渲染驱动，也能说明哪些路径已经被排除。

## 参考资料

- [Gazebo Sim command line](https://gazebosim.org/api/sim/8/gz_sim.html)
- [Gazebo sensors](https://gazebosim.org/docs/latest/sensors/)
- [ROS 2 QoS settings](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html)
- [ros_gz_bridge](https://github.com/gazebosim/ros_gz/tree/ros2/ros_gz_bridge)

## 证据边界

本文的现象、参数、提交和 CI 链接来自上述公开仓库。通过结果证明的是该提交在对应 GitHub Actions 环境中满足了工作流断言，不代表所有 Gazebo 版本、GPU/CPU 渲染后端或容器镜像都适用，也不证明真实相机、真实 AprilTag 检测或实体机器人对接性能。
