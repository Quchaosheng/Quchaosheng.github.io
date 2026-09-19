---
title: ROS 2 launch 事件与进程顺序：为什么 sleep 3 秒的启动脚本一定会偶发失败
date: 2026-09-06 09:30:00
permalink: /2026/09/06/ros2-launch-event-handlers-sequencing/
categories: [技术, ROS 2]
tags: [launch, 事件处理, 启动顺序, TimerAction]
---

CI 上间歇失败的启动脚本，追下去十有八九是延迟等待。开发机上跑得好好的，到了更慢的 runner 就开始偶发超时，然后有人把 3 秒改成 8 秒，暂时好了，过一阵机器更忙又不行。

我踩过不止一次。根子在于脚本用固定时长描述了一个本来由事件决定的条件——“前一个进程应该已经就绪了”。

<div class="note-flow"><span>启动前置进程</span><i>→</i><span>等目标事件</span><i>→</i><span>事件处理触发后续</span><i>→</i><span>同时挂超时兜底</span><i>→</i><span>超时即失败退出</span></div>

<figure class="note-visual"><figcaption><span>顺序的两种表达</span>固定延时描述时间，事件处理描述条件。只有后者在机器变慢时还成立。</figcaption><div class="note-map"><span><b>OnProcessStart</b><small>进程拉起来了，不代表初始化完成。</small></span><span><b>OnProcessExit</b><small>退出码和信号才是判断失败的依据。</small></span><span><b>TimerAction</b><small>显式延后，适合作兜底而不是主要手段。</small></span><span><b>OnTimer</b><small>到点产生事件，用来做超时判定。</small></span><span><b>EmitEvent</b><small>动作主动发事件，把条件串起来。</small></span><span><b>退出码</b><small>launch 的成败要反映关键进程的真实结果。</small></span></div></figure>

## 一个 3 秒里藏了三个问题

写 `TimerAction(period=3.0)` 的时候，隐含的判断是“3 秒后前一个进程已经就绪”。这个判断有三个毛病。

它没说清楚“就绪”的定义，是进程起来、参数读完、还是服务能响应。它把机器的性能写进了配置，慢机器不够快，快机器白等。最要命的是它没有失败路径——如果前一个进程其实崩了，延时到了脚本照样往下走，直到后面某个地方以一种更难解释的方式报错。

## 用进程事件替掉开头的延时

如果后续节点只要求某个进程已经被拉起，`OnProcessStart` 就够了：

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

但这里有个坑要提醒：进程启动不等于初始化完成。如果 `task_server` 一起来就调 `controller` 的服务，而对方还在读参数，这个方案照样失败。依赖的是“可用”而不是“已启动”时，得让被依赖方发出明确的可用信号。

## 让节点自己喊一声

我的做法是让前一个节点在真正就绪后发一条消息或响应一个服务，launch 侧把它转成事件。这样顺序条件就和业务语义对齐了：不是进程起来了，是我准备好接任务了。

```bash
# 先确认就绪条件在运行时能被外部看到
ros2 topic echo --once /controller/ready
ros2 service list | grep controller
```

如果这个条件在运行时压根观察不到，那 launch 里任何事件处理都只能退回猜测。把就绪定义成可观察的输出，是顺序编排能成立的前提。

## 超时必须有，而且要能失败

只等事件不设上限，条件永远不满足时启动就一直挂着，CI 只能靠作业级超时砍掉，日志里看不出卡在哪。

```python
from launch.actions import TimerAction, LogInfo

# 兜底：45 秒内没收到就绪就记录并结束
TimerAction(
    period=45.0,
    actions=[LogInfo(msg='controller ready timeout: aborting launch')],
)
```

真实项目里超时路径应该让 launch 以非零状态结束，而不是打一行日志继续跑。不然上层脚本仍然认为启动成功，问题被推迟到测试断言阶段，甚至被当成功能缺陷。

## 失败路径也要测

只验顺风路径的启动脚本，证明不了它在异常下可解释。至少覆盖三种：被依赖进程启动失败、就绪事件一直不出现、关键进程中途退出。

```bash
# 故意让被依赖进程失败，确认 launch 以失败结束
ros2 launch my_robot demo.launch.py --ros-args -p fail_on_purpose:=true
echo "launch exit code: $?"
```

退出码是关键证据。被依赖进程崩了 launch 还返回 0，说明顺序编排没把失败传出去。

## 延时什么时候还能用

不是完全不能用。两类场景下它合适：步骤之间没有可观察的依赖关系；或者作为事件方案的兜底上限。把延时当主要顺序手段才是问题所在。

如果依赖条件观察不到，正确方向是先在节点里补一个可观察的就绪信号，而不是把延时调大。调大只降低了失败频率，把必现变成偶发，排查成本反而更高。

## 参考资料

- [ROS 2 launch 事件处理器教程](https://docs.ros.org/en/jazzy/Tutorials/Intermediate/Launch/Using-Event-Handlers.html)
- [ros2/launch 仓库与事件 API](https://github.com/ros2/launch)
- [大型项目的 launch 组织方式](https://docs.ros.org/en/jazzy/Tutorials/Intermediate/Launch/Using-ROS2-Launch-For-Large-Projects.html)

**证据边界：**这里只讲 launch 的顺序表达能力，不含任何项目的启动耗时数据。上面的命令和结构是能跑的最小例子。“事件优于延时”这个判断得结合具体节点的就绪条件才成立——条件本身不可观察时，先补信号，别急着改写成事件。
