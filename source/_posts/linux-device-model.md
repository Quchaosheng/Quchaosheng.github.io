---
title: Linux 设备驱动模型：总线、设备和驱动如何相遇
date: 2026-07-29 16:09:18
source_checked_at: 2026-07-29 16:09:18
permalink: /2026/07/29/linux-device-model/
categories: [技术, 嵌入式Linux]
tags: [设备模型, 驱动, sysfs]
description: 从 bus、device、driver、class 与 probe 解释 Linux 设备模型，并给出 sysfs 和 uevent 的现场排查顺序。
---

驱动已经编译进内核，设备树里也有节点，为什么 `probe()` 仍然没有执行？Linux 设备模型把“系统中存在一个设备”和“某个驱动愿意管理它”分开注册，再由总线定义的匹配规则连接两者。理解 bus、device、driver 和 class 的关系，比在 `probe()` 入口盲目加日志更有效。

## 四个对象各管什么

- **device** 表示一个具体设备实例，携带父子关系、固件节点、资源与生命周期。
- **driver** 表示能够管理一类设备的实现，包含匹配表、`probe()`、`remove()` 与电源管理回调。
- **bus** 定义设备与驱动怎样匹配，例如 platform、PCI、USB、I2C 和 SPI 各有自己的规则。
- **class** 按功能向用户空间组织设备，例如 net、block、tty；它不是用于固件匹配的总线。

<div class="note-flow"><span>注册 device</span><i>→</i><span>注册 driver</span><i>→</i><span>总线执行 match</span><i>→</i><span>调用 probe</span><i>→</i><span>注册 class/子系统接口</span></div>

<div class="note-map"><span><b>固件描述</b><small>DT/ACPI 提供 compatible、资源与依赖</small></span><span><b>bus</b><small>维护 device/driver 并执行 match</small></span><span><b>probe</b><small>申请资源、初始化硬件、注册功能接口</small></span><span><b>class</b><small>按功能形成 /sys/class 视图</small></span><span><b>uevent</b><small>向用户空间报告 add/remove/change</small></span><span><b>引用计数</b><small>约束对象释放与并发访问</small></span></div>

## 匹配成功之后

以 platform 设备为例，设备可能来自设备树，驱动通过 `of_match_table` 声明 compatible。匹配成功只说明两者可以尝试绑定；`probe()` 仍可能因为时钟、regulator、GPIO、IRQ 或其他供应者尚未就绪而返回 `-EPROBE_DEFER`。内核会在依赖条件变化后重试，不应把延迟探测直接当成永久错误。

`probe()` 应按顺序取得资源、配置硬件并注册对外接口。`devm_*` 可以把部分资源生命周期绑定到 device，减少失败回滚代码，但不能替代硬件停机顺序、工作队列取消和外部引用处理。设备解绑或驱动卸载时，新的 I/O 必须先停止，再释放下层资源。

## 从 sysfs 排查

```bash
# 以某个 platform 设备为例
dev=/sys/bus/platform/devices/DEVICE_NAME
readlink -f "$dev/driver" 2>/dev/null || echo '尚未绑定驱动'
cat "$dev/modalias" 2>/dev/null
cat "$dev/uevent" 2>/dev/null

# 查看驱动已经绑定的设备
ls -l /sys/bus/platform/drivers/DRIVER_NAME/
dmesg -T | grep -i -E 'defer|probe|DEVICE_NAME'
```

排查顺序应是：设备是否被枚举、挂在哪条 bus、modalias/compatible 是否匹配、驱动模块是否存在、probe 是否返回错误或 defer。`/sys/class` 中没有节点并不一定说明设备未匹配，也可能是 probe 尚未注册对应功能接口。

## uevent 与自动加载

设备注册时可产生 uevent，用户空间设备管理器根据 `MODALIAS` 等信息加载模块并创建设备节点。模块加载成功仍不等于 probe 成功；设备节点存在也不保证硬件已经完成所有运行时初始化。容器或精简系统中，udev 规则和模块自动加载机制还可能被裁剪。

## 证据边界

本文描述通用驱动模型。PCI、USB、I2C、SPI 等总线的枚举、匹配和热插拔细节不同；实际分析必须以对应 bus 文档、目标内核日志和 sysfs 拓扑为准。

参考：[The Linux Kernel Device Model](https://docs.kernel.org/driver-api/driver-model/overview.html) · [Device drivers infrastructure](https://docs.kernel.org/driver-api/infrastructure.html) · [从 0 到 1，带你吃透 Linux 设备驱动模型](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247495135&idx=1&sn=aceb59f8174c88b6846b3416a4f1cf6a)
