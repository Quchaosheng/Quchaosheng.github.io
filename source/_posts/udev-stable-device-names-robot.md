---
title: udev 规则与设备名：为什么 ttyACM0 不能写进机器人配置
date: 2026-09-15 09:30:00
permalink: /2026/09/15/udev-stable-device-names-robot/
categories: [技术, 嵌入式Linux]
tags: [udev, 设备节点, 串口, 权限]
---

机器人上接了激光雷达、IMU、电机控制器和几个串口设备。开机后它们通常出现在 `/dev/ttyACM0`、`/dev/ttyUSB0` 这类名字下。这些名字由内核按枚举顺序分配，拔插一次、重启一次或者少接一个设备，顺序就可能改变。

把这类名字写进配置文件，故障现象通常是“开机后电机不动，但报错说找不到设备”，或者更糟：找到了设备，但其实是另一个。这篇文章讨论如何用稳定标识代替顺序编号，以及权限该怎么给。

<div class="note-flow"><span>读取设备唯一属性</span><i>→</i><span>编写匹配规则</span><i>→</i><span>创建稳定符号链接</span><i>→</i><span>设置属主与权限</span><i>→</i><span>重载并触发规则</span><i>→</i><span>在程序里使用稳定名</span></div>

<figure class="note-visual"><figcaption><span>从顺序名到稳定名</span>匹配依据应当是设备自身属性，而不是它被枚举到的次序。</figcaption><div class="note-map"><span><b>顺序名</b><small>由内核按枚举顺序分配，重启和拔插后可能改变。</small></span><span><b>序列号</b><small>设备自带且唯一，是最稳定的匹配依据。</small></span><span><b>VID/PID</b><small>能识别型号，但同型号多台时无法区分。</small></span><span><b>物理路径</b><small>按插在哪个端口区分，适合固定安装的整机。</small></span><span><b>符号链接</b><small>规则创建的名称，程序只依赖它。</small></span><span><b>权限</b><small>用属组和模式授权，避免依赖 root 运行。</small></span></div></figure>

## 先确认设备的稳定属性

```bash
udevadm info --name=/dev/ttyACM0 --attribute-walk
```

重点看三类属性。`serial` 是设备序列号，同型号多台设备也能区分，通常是最佳选择。`idVendor` 与 `idProduct` 识别型号，适合同型号只有一台的情况。`KERNELS` 或 `DEVPATH` 描述物理端口位置，适合设备固定焊在整机内部、端口不会变的产品。

只看 `idVendor`/`idProduct` 就写规则是常见错误。两块同型号的 USB 转串口同时接上时，两条规则会匹配到同一个设备顺序，符号链接互相覆盖，最终哪个是哪个取决于枚举顺序。

## 规则要既匹配又命名

```bash
# /etc/udev/rules.d/60-robot-devices.rules
SUBSYSTEM=="tty", ATTRS{idVendor}=="1a86", ATTRS{serial}=="ROBOT-MOTOR-0001", \
  SYMLINK+="robot/motor", MODE="0660", GROUP="robot"
SUBSYSTEM=="tty", ATTRS{idVendor}=="1a86", ATTRS{serial}=="ROBOT-LIDAR-0001", \
  SYMLINK+="robot/lidar", MODE="0660", GROUP="robot"
```

几个要点。`SUBSYSTEM` 加上可以避免匹配到非 tty 设备。`ATTRS` 会沿设备父链向上查找，比只匹配当前节点的 `ATTR` 更常用，因为序列号往往在 USB 设备层而不是 tty 层。`SYMLINK` 使用带目录的名字能把设备集中到一处，便于查看。

`MODE` 和 `GROUP` 是为了避免程序必须以 root 运行。给 0660 加专用属组，比给全局可读写更安全，也让权限范围可以审计。

## 顺序名要主动修掉

创建符号链接之后，`/dev/ttyACM0` 仍然存在。如果程序里还残留着顺序名，故障依旧存在。检查方式是搜索配置和启动文件：

```bash
grep -rn "ttyACM\|ttyUSB" /opt/robot/config /etc/systemd/system 2>/dev/null
```

需要改的是所有引用点：ROS 2 节点的参数、launch 文件、unit 文件的参数。只改一处，剩下的仍然按顺序名打开。

## 重载和验证

```bash
sudo udevadm control --reload-rules
sudo udevadm trigger
ls -l /dev/robot/
udevadm info --name=/dev/robot/motor --query=symlink
```

验证时应该做拔插和重启测试，而不只是执行命令看链接是否存在。判断规则是否真的稳定，标准是多次拔插和重启后符号链接始终指向同一个物理设备。

一个实用的确认方式是记录设备序列号并和打开的文件对比：先读 `/dev/robot/motor` 的序列号，再确认程序打开的就是这个设备。如果两处不一致，规则匹配范围过宽。

## 和容器、权限的关系

在容器里运行程序时，符号链接需要在容器内可见，通常通过挂载设备或转发 udev 事件实现。只挂载 `/dev` 而不处理设备属性，容器内可能看不到稳定名字。

权限方面，还要注意程序运行用户的属组是否包含规则里指定的组。修改属组后需要重新登录或重启相关服务才会生效，这一点在排查“权限明明给了却打不开”时经常被忽略。

## 参考资料

- [udev 手册页：规则语法与匹配键](https://man7.org/linux/man-pages/man7/udev.7.html)
- [udevadm 手册页](https://man7.org/linux/man-pages/man8/udevadm.8.html)
- [systemd 设备管理说明](https://man7.org/linux/man-pages/man5/systemd.device.5.html)

## 证据边界

本文讨论设备命名的稳定性和权限配置方式，不包含任何具体硬件的规则文件。文中示例中的 VID、序列号需替换为实际设备属性；符号链接是否稳定必须通过重复拔插和重启验证，单次成功不足以说明问题已经解决。
