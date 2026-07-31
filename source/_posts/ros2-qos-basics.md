---
title: ROS 2 QoS 入门：可靠、尽力而为和队列深度到底控制什么
date: 2026-04-30 09:30:00
permalink: /2026/04/30/ros2-qos-basics/
categories: [技术, AI机器人]
tags: [ROS 2, QoS, DDS, Reliability, Durability]
---

相机话题明明存在，订阅节点却一条消息也收不到；把 `reliable` 改成 `best_effort` 后突然正常。ROS 2 的 QoS 不是“网络优化参数”，它是发布者与订阅者之间的数据契约。策略不兼容时，双方甚至不会建立有效通信。

<div class="note-flow"><span>识别数据能否丢失</span><i>→</i><span>设置可靠性和历史深度</span><i>→</i><span>检查发布订阅兼容性</span><i>→</i><span>加入 deadline 与 liveliness</span><i>→</i><span>验证丢包和过期行为</span></div>

<figure class="note-visual"><figcaption><span>QoS 契约图</span>发布者提供的能力要满足订阅者请求，队列和可靠性也要符合数据用途。</figcaption><div class="note-map"><span><b>Reliability</b><small>Reliable 尝试重传，Best Effort 允许丢失以减少等待。</small></span><span><b>History</b><small>Keep Last 保存有限条，Keep All 需要更严格的资源边界。</small></span><span><b>Depth</b><small>队列深度过大可能积累旧数据，过小可能丢掉突发消息。</small></span><span><b>Durability</b><small>Transient Local 可让晚加入订阅者收到缓存状态。</small></span><span><b>Deadline</b><small>声明期望更新周期，超期事件不等于自动停车。</small></span><span><b>Liveliness</b><small>帮助发现发布者是否仍活跃，业务恢复仍需状态机。</small></span></div></figure>

## 先看实际 QoS

```bash
ros2 topic info /camera/image_raw --verbose
ros2 topic info /cmd_vel --verbose
```

`--verbose` 会显示端点和 QoS。排查“话题有但没数据”时，先比较发布者与订阅者的 reliability、durability 和其他策略，不要只重启节点。

兼容性要从“发布者提供什么、订阅者要求什么”这个方向看。下面这张表只列最容易踩到的两组策略：

| 发布者提供 | 订阅者请求 | 能否匹配 | 原因 |
| --- | --- | --- | --- |
| Reliable | Reliable | 可以 | 发布端满足可靠传输请求 |
| Reliable | Best Effort | 可以 | 订阅端接受较弱保证 |
| Best Effort | Best Effort | 可以 | 双方都允许丢失 |
| Best Effort | Reliable | 不可以 | 发布端无法满足可靠请求 |
| Transient Local | Volatile | 可以 | 发布端能力高于订阅要求 |
| Volatile | Transient Local | 不可以 | 发布端没有历史样本可交付 |

`depth` 并不按较大值自动协商。发布者和订阅者各自维护队列，较大的订阅队列也补不回网络上已经丢掉的样本。

## 用两个进程复现 QoS 不兼容

下面的脚本既能当发布者，也能当订阅者。它只依赖 `rclpy` 和 `std_msgs`，保存为 `qos_probe.py` 后即可运行。

```python
import sys

import rclpy
from rclpy.node import Node
from rclpy.qos import HistoryPolicy, QoSProfile, ReliabilityPolicy
from std_msgs.msg import UInt32


def make_qos(name: str, depth: int) -> QoSProfile:
    reliability = {
        "reliable": ReliabilityPolicy.RELIABLE,
        "best_effort": ReliabilityPolicy.BEST_EFFORT,
    }[name]
    return QoSProfile(
        history=HistoryPolicy.KEEP_LAST,
        depth=depth,
        reliability=reliability,
    )


class Probe(Node):
    def __init__(self, mode: str, reliability: str, depth: int) -> None:
        super().__init__(f"qos_probe_{mode}")
        qos = make_qos(reliability, depth)
        if mode == "pub":
            self.count = 0
            self.publisher = self.create_publisher(UInt32, "/qos_probe", qos)
            self.timer = self.create_timer(0.1, self.publish_one)
        else:
            self.subscription = self.create_subscription(
                UInt32, "/qos_probe", self.receive_one, qos
            )

    def publish_one(self) -> None:
        message = UInt32()
        message.data = self.count
        self.publisher.publish(message)
        self.count += 1

    def receive_one(self, message: UInt32) -> None:
        self.get_logger().info(f"received={message.data}")


def main() -> None:
    mode = sys.argv[1]
    reliability = sys.argv[2]
    depth = int(sys.argv[3]) if len(sys.argv) > 3 else 10
    rclpy.init()
    node = Probe(mode, reliability, depth)
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()
```

先在终端 A 启动一个只提供 Best Effort 的发布者：

```bash
source /opt/ros/jazzy/setup.bash
python3 qos_probe.py pub best_effort 5
```

终端 B 请求 Reliable，正常结果是发现端点但收不到样本；改成 Best Effort 后应该持续看到计数。

```bash
source /opt/ros/jazzy/setup.bash
python3 qos_probe.py sub reliable 5
# Ctrl-C 后再试兼容配置
python3 qos_probe.py sub best_effort 5
```

同时运行 `ros2 topic info /qos_probe --verbose`，把“不出数据”对应到两端的实际策略。这个实验只验证端点兼容性，不模拟 Wi-Fi 丢包，也不能比较 Reliable 和 Best Effort 的尾延迟。

## Reliable 不是所有数据的默认答案

相机和激光雷达是连续更新的数据，旧帧价值很低。网络拥塞时等待重传可能让队列越来越旧，因此传感器常用 Best Effort。配置命令、地图或低频状态可能更需要 Reliable。

```text
高频、可由新值替代旧值 -> Best Effort + 小队列
低频、不能静默丢失     -> Reliable + 明确超时
```

Reliable 只提高 DDS 传输层的交付保证，不证明执行器已经完成动作。机器人命令仍需要序号、状态反馈和 watchdog。

如果当前问题还是“这里究竟该用 Topic 还是 Action”，先回到[ROS 2 通信方式的选择](/2026/03/31/ros2-communication-basics/)。接口语义定错以后，调 QoS 只能改变消息怎么送，补不出任务反馈和取消能力。

## 队列深度决定新鲜度和抗突发能力

Depth 为 10 表示 Keep Last 时最多保留 10 条样本。消费者比生产者慢时，较大的队列会让它继续处理旧消息；较小队列会较早覆盖旧消息。控制系统通常更关心最新值，日志或审计系统更关心完整性，两者不应共用同一策略。

可以同时观察频率和时间戳：

```bash
ros2 topic hz /camera/image_raw
ros2 topic echo --once /camera/image_raw/header
```

频率正常但 `header.stamp` 很旧，说明问题可能在排队，不在相机帧率。

订阅回调本身处理太慢时，还要继续检查[Executor 与回调组](/2026/02/17/ros2-executor-callback-groups-basics/)。DDS 队列和 Executor 等待是两段不同的时间，最好分别记录。

## Durability 决定晚加入者能看到什么

Volatile 只接收建立连接后的新样本。Transient Local 允许发布者缓存样本，新订阅者加入后可以收到最近状态。静态地图、配置状态或一次性发布的描述信息可能需要后者；高速图像通常不需要。

发布者使用 Volatile、订阅者强求 Transient Local 时可能不兼容。策略要从数据生命周期出发，不要单独改订阅端。

## Deadline 和 Liveliness 需要业务动作

Deadline 可以检测数据没有按期到达，Liveliness 可以检测端点是否仍活跃。事件回调只告诉你契约被破坏，机器人要不要降速、停车或重连，仍由业务状态机决定。

| 数据 | 常见关注点 | 失败动作示例 |
| --- | --- | --- |
| 相机图像 | 新鲜度、丢帧 | 丢旧帧、降低速度 |
| 速度命令 | deadline、watchdog | 安全减速或停车 |
| 静态地图 | durability、完整性 | 等待地图后再启动 |
| 诊断事件 | reliable、队列 | 限流并保留错误原因 |

## 参考资料

- [ROS 2 QoS settings](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html)
- [ROS 2 Topic statistics](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Topic-Statistics.html)
- [ROS 2 DDS implementations](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Different-Middleware-Vendors.html)

**证据边界：**本文给出 QoS 的基础选择方法，具体默认值和兼容行为受 ROS 2 发行版、RMW 和网络环境影响。策略修改必须在目标节点和故障场景下验证。
