---
title: 用 systemd 托管 ROS 2 节点：重启策略和进程组决定了故障传播
date: 2026-09-07 09:30:00
permalink: /2026/09/07/systemd-ros2-service-restart-boundaries/
categories: [技术, 嵌入式Linux]
tags: [systemd, 服务化, 进程管理, 故障恢复]
---

在开发机上，机器人程序通常由人在终端里启动；到设备上，它需要开机自启、崩溃后恢复、日志可追溯。用 systemd 托管是常见选择，但“写一个 unit 文件”和“定义清楚故障边界”是两件事。

这篇文章关注三个容易被忽略的决策：重启策略描述了哪些失败、进程组决定了停止信号发给谁、以及退出码最终如何被系统解释。它们共同决定了一个节点崩溃时，系统是局部恢复还是整体失控。

<div class="note-flow"><span>unit 定义启动命令</span><i>→</i><span>限定运行用户与权限</span><i>→</i><span>定义重启条件</span><i>→</i><span>限定进程组与信号</span><i>→</i><span>限制资源与优先级</span><i>→</i><span>日志进入 journal</span></div>

<figure class="note-visual"><figcaption><span>托管边界</span>unit 文件写的是期望状态；实际恢复行为由重启条件、信号和超时共同决定。</figcaption><div class="note-map"><span><b>Restart=</b><small>on-failure 与 always 对“失败”的定义不同。</small></span><span><b>KillMode</b><small>决定停止时只杀主进程，还是整个进程组。</small></span><span><b>TimeoutStopSec</b><small>超时后升级为强杀，可能留下未释放的硬件资源。</small></span><span><b>After/Wants</b><small>描述启动顺序和依赖，不等于依赖已就绪。</small></span><span><b>权限</b><small>实时能力、设备访问和文件权限都应显式声明。</small></span><span><b>journal</b><small>标准输出与退出码是事后定位问题的主要证据。</small></span></div></figure>

## 重启策略要匹配失败类型

`Restart=always` 听起来最稳妥，实则会掩盖配置错误。如果节点因为参数非法而每次启动都立刻退出，`always` 会把它变成一个持续重启的循环，日志被反复刷屏，真正原因反而更难发现。

更常见的选择是 `Restart=on-failure`，它只在非正常退出时重启。配合 `StartLimitIntervalSec` 与 `StartLimitBurst`，可以限制短时间内重启次数，避免无限循环：

```ini
[Service]
ExecStart=/opt/robot/bin/task_server
Restart=on-failure
RestartSec=2
StartLimitIntervalSec=60
StartLimitBurst=5
```

这几个值的含义需要和节点行为对齐。如果节点在配置错误时以 0 退出，`on-failure` 就不会重启，问题会被静默接受；如果节点在所有错误路径上都以非零退出，那么一个暂时的设备占用会触发重启。退出码应当是节点对外契约的一部分，而不是随手写 `return -1`。

## 进程组决定停止时谁会收到信号

ROS 2 节点经常以 launch 或脚本形式启动子进程。默认情况下，停止服务时 systemd 会终止整个控制组，这在大多数场景下是正确的。但如果启动脚本自己管理子进程，`KillMode` 的选择就会影响资源释放。

```bash
systemctl show my-robot.service -p KillMode -p TimeoutStopSec
```

`TimeoutStopSec` 之后 systemd 会升级为强杀。对于持有 SocketCAN 句柄、串口或 CAN 设备的进程，强杀意味着没有机会执行安全停止。因此清理时间必须留够，而安全动作本身最好由设备侧看门狗独立兜底，而不是只依赖进程优雅退出。

## 依赖顺序不等于依赖就绪

`After=` 和 `Wants=` 描述的是启动顺序和依赖关系，不表示被依赖的服务已经可以工作。这一点和 launch 的延时问题同源：顺序被表达出来了，条件没有。

如果确实需要等待条件，常见做法是在 unit 里使用健康检查命令配合 `ExecStartPre`，或者让上层节点自己重试连接，而不是依赖一个固定延时。重试要有限次并且有明确失败出口，否则又会退化成无限等待。

## 权限与实时能力应显式声明

实时任务需要的能力不应该通过“用 root 跑”来解决。systemd 提供了更窄的授权方式：

```ini
[Service]
User=robot
AmbientCapabilities=CAP_SYS_NICE
LimitRTPRIO=80
LimitMEMLOCK=infinity
```

这些声明也需要被验证。写进 unit 不代表实际生效，容器、cgroup 版本和内核配置都可能改变结果。验证方式是运行后回读进程的真实限制，而不是假设配置已经生效。

## 日志和退出码是最终证据

```bash
journalctl -u my-robot.service -n 50 --no-pager
systemctl status my-robot.service
```

判断一次故障时，至少要能回答：进程以什么退出码结束、是被信号终止还是主动退出、重启了几次、最后一次重启前发生了什么。如果这些信息只能靠翻应用日志，说明单元配置还没有把运行状态完整暴露出来。

## 参考资料

- [systemd.service(5)：重启与退出语义](https://man7.org/linux/man-pages/man5/systemd.service.5.html)
- [systemd.exec(5)：权限与资源限制](https://man7.org/linux/man-pages/man5/systemd.exec.5.html)
- [systemd.kill(5)：KillMode 与停止信号](https://man7.org/linux/man-pages/man5/systemd.kill.5.html)

## 证据边界

本文讨论 systemd 的托管语义与配置选项，不包含任何具体设备上的实测恢复时间。重启策略、超时和权限配置都需要在目标系统上验证实际行为；“服务能自启”也不等于“故障能恢复”，安全相关的停止动作应另有独立机制。
