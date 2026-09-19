---
title: 用 systemd 托管 ROS 2 节点：重启策略和进程组决定了故障传播
date: 2026-09-07 09:30:00
permalink: /2026/09/07/systemd-ros2-service-restart-boundaries/
categories: [技术, 嵌入式Linux]
tags: [systemd, 服务化, 进程管理, 故障恢复]
---

开发机上机器人程序都是人在终端里敲起来的，到了设备上就得开机自启、崩了能恢复、日志能查。用 systemd 是最常见的路子，但写个 unit 文件容易，把故障边界想清楚不容易。

我见过 `Restart=always` 配上一个参数错误的节点，结果服务每两秒重启一次，日志被刷满，真正的原因淹没在重启记录里。

<div class="note-flow"><span>定义启动命令</span><i>→</i><span>限定用户和权限</span><i>→</i><span>定义重启条件</span><i>→</i><span>限定进程组和信号</span><i>→</i><span>限制资源与优先级</span><i>→</i><span>日志进 journal</span></div>

<figure class="note-visual"><figcaption><span>托管边界</span>unit 写的是期望状态，实际恢复行为由重启条件、信号和超时一起决定。</figcaption><div class="note-map"><span><b>Restart=</b><small>on-failure 和 always 对“失败”的定义不同。</small></span><span><b>KillMode</b><small>停止时只杀主进程，还是整个进程组。</small></span><span><b>TimeoutStopSec</b><small>超时升级为强杀，可能留下没释放的硬件。</small></span><span><b>After/Wants</b><small>描述启动顺序，不等于依赖已就绪。</small></span><span><b>权限</b><small>实时能力、设备访问、文件权限都要显式写。</small></span><span><b>journal</b><small>标准输出和退出码是事后定位的主要证据。</small></span></div></figure>

## Restart=always 经常是错的

`always` 看着最稳妥，实际上会掩盖配置错误。节点因为参数非法每次启动就退出，`always` 把它变成一个持续重启的循环，日志翻来翻去也看不到重点。

更常用的是 `on-failure`，只在非正常退出时重启，再配上重启次数限制：

```ini
[Service]
ExecStart=/opt/robot/bin/task_server
Restart=on-failure
RestartSec=2
StartLimitIntervalSec=60
StartLimitBurst=5
```

这几个值要和节点的行为对上。如果节点配置错误时以 0 退出，`on-failure` 就不会重启，问题被静默接受。如果所有错误路径都返回非零，一次临时的设备占用也会触发重启。退出码应该是节点对外契约的一部分，不是随手写的 `return -1`。

## 停止时到底杀谁

ROS 2 节点经常通过 launch 或脚本拉起子进程。默认情况下 systemd 会终止整个控制组，多数场景这是对的。但启动脚本自己管子进程时，`KillMode` 的选择就影响资源释放。

```bash
systemctl show my-robot.service -p KillMode -p TimeoutStopSec
```

`TimeoutStopSec` 到点后 systemd 升级为强杀。对持有 SocketCAN 句柄、串口或 CAN 设备的进程，强杀意味着没机会执行安全停止。所以清理时间要留够，而安全动作本身最好由设备侧看门狗独立兜底，不要只靠进程优雅退出。

## After 不等于就绪

`After=` 和 `Wants=` 描述的是启动顺序和依赖，不表示被依赖的服务已经能干活了。这跟 launch 的延时问题是同一个毛病：顺序表达了，条件没表达。

确实需要等条件时，常见做法是用健康检查命令配 `ExecStartPre`，或者让上层节点自己重试连接。重试要有次数上限和明确的失败出口，否则又退化成无限等待。

## 权限别用 root 解决

实时任务需要的能力，不该靠“用 root 跑”来绕过。systemd 提供了更窄的授权方式：

```ini
[Service]
User=robot
AmbientCapabilities=CAP_SYS_NICE
LimitRTPRIO=80
LimitMEMLOCK=infinity
```

写到 unit 里不等于生效。容器、cgroup 版本和内核配置都会改变结果，得在运行后回读进程的真实限制，而不是假设配置已经起作用。

## 出了事要能查

```bash
journalctl -u my-robot.service -n 50 --no-pager
systemctl status my-robot.service
```

判断一次故障，至少得能回答：进程以什么退出码结束、是被信号杀的还是自己退的、重启了几次、最后一次重启前发生了什么。这些如果只能靠翻应用日志，说明单元配置还没把运行状态暴露出来。

## 参考资料

- [systemd.service(5)：重启与退出语义](https://man7.org/linux/man-pages/man5/systemd.service.5.html)
- [systemd.exec(5)：权限与资源限制](https://man7.org/linux/man-pages/man5/systemd.exec.5.html)
- [systemd.kill(5)：KillMode 与停止信号](https://man7.org/linux/man-pages/man5/systemd.kill.5.html)

**证据边界：**本文不包含任何设备上的实测恢复时间。重启策略、超时和权限都要在目标系统上验证实际行为。“服务能自启”也不等于“故障能恢复”，安全相关的停止动作应该有独立机制。
