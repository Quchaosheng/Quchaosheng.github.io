---
title: ROS 2 launch 事件与进程顺序：为什么 sleep 3 秒的启动脚本一定会偶发失败
date: 2026-09-06 09:30:00
permalink: /2026/09/06/ros2-launch-event-handlers-sequencing/
categories: [技术, ROS 2]
tags: [launch, 事件处理, 启动顺序, TimerAction]
---

一个包含仿真、控制器、感知和任务节点的 launch 文件，最常见的写法是启动前几个节点，等几秒，再启动后面的。这在开发者机器上通常能跑通，在 CI 或更慢的机器上会间歇失败。原因不是等待时间不够长，而是启动脚本在用一个固定时长描述一个由事件决定的前置条件。

launch 提供了事件处理机制来表达这种条件。这篇文章按“条件是什么—谁来发出它—超时怎么办”的顺序展开，因为如果条件本身没定义清楚，换成事件也只是把轮询换了个形式。

<div class="note-flow"><span>启动前置进程</span><i>→</i><span>等待目标事件</span><i>→</i><span>事件处理触发后续动作</span><i>→</i><span>同时启动超时兜底</span><i>→</i><span>超时即失败退出</span></div>

<figure class="note-visual"><figcaption><span>顺序的两种表达</span>固定延时描述时间，事件处理器描述条件；只有后者能在机器变慢时保持语义。</figcaption><div class="note-map"><span><b>OnProcessStart</b><small>进程已拉起，不代表它已经完成初始化或对外可用。</small></span><span><b>OnProcessExit</b><small>退出码与信号是判断失败的依据，不能只看进程消失。</small></span><span><b>TimerAction</b><small>显式延后动作，适合作为兜底而不是主要顺序手段。</small></span><span><b>OnTimer</b><small>延迟到点后产生事件，用于超时判定。</small></span><span><b>EmitEvent</b><small>由动作主动发出自定义事件，串起条件链。</small></span><span><b>退出码</b><small>launch 的最终成败应反映关键进程的真实结果。</small></span></div></figure>

## 延时到底在等什么

写 `TimerAction(period=3.0)` 时，逻辑上隐含着一个条件判断：“3 秒后，前一个进程应该已经就绪”。这个隐含条件有三个问题。

第一，它没有说明就绪的定义。是进程启动、参数加载完成、还是已经开始响应服务。第二，它把机器的负载能力写进了配置，慢机器上不够，快机器上白等。第三，它没有失败路径：如果前一个进程其实崩溃了，脚本仍然会在延时结束后继续启动后续节点，直到更晚的地方以更难解释的方式报错。

事件处理的价值在于把这些隐含条件变成显式判断，并给每条路径一个明确的出口。

## 用进程事件替代开始延时

如果后续节点只依赖某个进程已经被拉起，可以用 `OnProcessStart`：

```python
from launch import LaunchDescription
from launch.actions import RegisterEventHandler
from launch.event_handlers import OnProcessStart
from launch_ros.actions import Node

def generate_launch_description():
    controller = Node(package='my_robot', executable='controller')
    return LaunchDescription([
        controller,
        RegisterEventHandler(
            OnProcessStart(
                target_action=controller,
                on_start=[Node(package='my_robot', executable='task_server')],
            )
        ),
    ])
```

这里要警惕一个常见误解：进程启动不等于初始化完成。如果 `task_server` 在启动时会立刻调用 `controller` 的服务，而 `controller` 还在读参数，这个方案仍然会失败。依赖“可用”而不是“已启动”时，需要让被依赖方发出一个明确的可用信号。

## 让节点自己发出就绪信号

更可靠的做法是让前一个节点在真正就绪后发布一条消息或服务响应，launch 侧用 `EmitEvent` 把它转成事件。这样顺序条件就和业务语义对齐了：不是“进程起来了”，而是“我准备好接收任务了”。

```bash
# 先确认就绪条件可以被外部观察到
ros2 topic echo --once /controller/ready
ros2 service list | grep controller
```

如果这个条件在运行时无法被外部观察到，那么 launch 里的任何事件处理都只能退回到猜测。把就绪定义为可观察的输出，是顺序编排能成立的前提。

## 超时必须显式，而且要导致失败

事件处理的另一个必要部分是超时。只等待事件而不设上限，会让启动在条件永远不满足时一直挂着，CI 只能靠作业级超时来终止，日志里看不出卡在哪一步。

```python
from launch.actions import TimerAction, LogInfo

# 兜底：45 秒内没有收到就绪事件就记录并结束
TimerAction(
    period=45.0,
    actions=[LogInfo(msg='controller ready timeout: aborting launch')],
)
```

在真实项目里，超时路径应当让 launch 以非零状态结束，而不是打印一行日志后继续。否则上层脚本仍然认为启动成功，问题会推迟到测试断言阶段，甚至被误判成功能缺陷。

## 失败路径也要一起测

只验证顺风路径的启动脚本，无法证明它在异常情况下是可解释的。至少应该覆盖三种情况：被依赖进程启动失败、就绪事件一直没有出现、以及关键进程中途退出。

```bash
# 故意让被依赖进程失败，确认 launch 会以失败结束
ros2 launch my_robot demo.launch.py --ros-args -p fail_on_purpose:=true
echo "launch exit code: $?"
```

退出码是关键证据。如果被依赖进程崩溃时 launch 仍然返回 0，顺序编排就没有真正把失败传播出去。

## 什么时候延时仍然可用

延时不是完全不能用。它适合两类场景：一是步骤之间没有可观察的依赖关系，二是作为事件方案的兜底上限。把延时当作主要顺序手段，才是问题的来源。

当依赖条件无法被观察到时，正确的方向是先在节点里补一个可观察的就绪信号，而不是把延时调大。调大延时只是降低了失败频率，让问题从必现变成偶发，排查成本反而更高。

## 参考资料

- [ROS 2 launch 事件处理器教程](https://docs.ros.org/en/jazzy/Tutorials/Intermediate/Launch/Using-Event-Handlers.html)
- [ros2/launch 仓库与事件 API](https://github.com/ros2/launch)
- [大型项目的 launch 组织方式](https://docs.ros.org/en/jazzy/Tutorials/Intermediate/Launch/Using-ROS2-Launch-For-Large-Projects.html)

## 证据边界

本文讨论 launch 的顺序表达能力，不包含任何特定项目的启动耗时数据。文中给出的命令和结构是可运行的最小示例；“事件优于延时”这一判断需要结合具体节点的就绪条件成立才有效，若依赖条件本身不可观察，应先补充可观察信号，而不是直接改写成事件处理。
