---
title: udev 规则与设备名：为什么 ttyACM0 不能写进机器人配置
date: 2026-09-15 09:30:00
permalink: /2026/09/15/udev-stable-device-names-robot/
categories: [技术, 嵌入式Linux]
tags: [udev, 设备节点, 串口, 权限]
---

被这件事坑过一次：整机上接了雷达、IMU 和电机控制器，开发的时候一切正常。发到客户那边开机后动不了，日志说找不到设备。

原因很简单，我只接了其中两个设备，编号和整机不一样，`/dev/ttyACM0` 指向了别的东西。更糟的是那次它没报错，只是打开了一个错误的设备。

那之后就再也不在配置里写顺序编号了。

<div class="note-flow"><span>读设备唯一属性</span><i>→</i><span>写匹配规则</span><i>→</i><span>创建稳定符号链接</span><i>→</i><span>设属主和权限</span><i>→</i><span>重载并触发规则</span><i>→</i><span>程序只用稳定名</span></div>

<figure class="note-visual"><figcaption><span>从顺序名到稳定名</span>匹配依据应该是设备自身的属性，而不是它被枚举到的次序。</figcaption><div class="note-map"><span><b>顺序名</b><small>内核按枚举顺序分配，重启和拔插后会变。</small></span><span><b>序列号</b><small>设备自带且唯一，最稳定的匹配依据。</small></span><span><b>VID/PID</b><small>能认型号，但同型号多台时区分不了。</small></span><span><b>物理路径</b><small>按插在哪个口区分，适合固定安装的整机。</small></span><span><b>符号链接</b><small>规则创建的名字，程序只依赖它。</small></span><span><b>权限</b><small>用属组和模式授权，别依赖 root 运行。</small></span></div></figure>

## 先看设备有什么稳定属性

```bash
udevadm info --name=/dev/ttyACM0 --attribute-walk
```

重点看三类。`serial` 是设备序列号，同型号多台也能区分，通常最好用。`idVendor` 和 `idProduct` 认型号，适合同型号只有一台的情况。`KERNELS` 或 `DEVPATH` 描述物理端口位置，适合设备焊在整机内部、口不会变的产品。

只拿 `idVendor`/`idProduct` 写规则是常见错误。两块同型号 USB 转串口同时插上，两条规则会匹到同一个设备顺序上，符号链接互相覆盖，最后哪个是哪个看枚举顺序。

## 规则怎么写

```bash
# /etc/udev/rules.d/60-robot-devices.rules
SUBSYSTEM=="tty", ATTRS{idVendor}=="1a86", ATTRS{serial}=="ROBOT-MOTOR-0001", \
  SYMLINK+="robot/motor", MODE="0660", GROUP="robot"
SUBSYSTEM=="tty", ATTRS{idVendor}=="1a86", ATTRS{serial}=="ROBOT-LIDAR-0001", \
  SYMLINK+="robot/lidar", MODE="0660", GROUP="robot"
```

几点说明。加 `SUBSYSTEM` 能避免匹到非 tty 设备。用 `ATTRS` 而不是 `ATTR`，因为它会沿父链向上找，序列号往往在 USB 设备层而不是 tty 层。`SYMLINK` 带目录名能把设备集中到一处，方便查看。

`MODE` 和 `GROUP` 是为了不让程序必须以 root 跑。给 0660 配专用属组，比全局可读写安全，权限范围也更好审计。

## 顺序名要主动清掉

建了符号链接，`/dev/ttyACM0` 还在。程序里如果还留着顺序名，故障照旧。搜一遍：

```bash
grep -rn "ttyACM\|ttyUSB" /opt/robot/config /etc/systemd/system 2>/dev/null
```

要改的是所有引用点：ROS 2 节点参数、launch 文件、unit 文件的参数。只改一处，剩下的仍然按顺序名打开。

## 验的时候要真拔插

```bash
sudo udevadm control --reload-rules
sudo udevadm trigger
ls -l /dev/robot/
udevadm info --name=/dev/robot/motor --query=symlink
```

光执行命令看链接存不存在不够。判断规则稳不稳，标准是反复拔插和重启之后，符号链接始终指向同一个物理设备。

一个实用的确认方式是读一下 `/dev/robot/motor` 的序列号，跟预期对一遍。对不上说明规则匹得太宽了。

## 容器和权限

在容器里跑程序时，符号链接要能在容器内看到，一般靠挂载设备或者转发 udev 事件。只挂 `/dev` 不处理设备属性，容器里可能就没有稳定名字。

权限还有个容易忽略的点：程序运行用户的属组得包含规则里指定的组。改完属组要重新登录或者重启服务才生效，排查“权限明明给了却打不开”时经常卡在这。

## 参考资料

- [udev 手册页：规则语法与匹配键](https://man7.org/linux/man-pages/man7/udev.7.html)
- [udevadm 手册页](https://man7.org/linux/man-pages/man8/udevadm.8.html)
- [systemd 设备管理说明](https://man7.org/linux/man-pages/man5/systemd.device.5.html)

**证据边界：**本文不含任何具体硬件的规则文件。示例里的 VID 和序列号要换成实际设备属性。符号链接稳不稳必须靠重复拔插和重启验证，一次成功说明不了问题已经解决。
