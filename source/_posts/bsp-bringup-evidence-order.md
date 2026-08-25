---
title: BSP Bring-up 的排障顺序：从原理图走到真实读写
date: 2026-08-18 20:30:00
permalink: /2026/08/18/bsp-bringup-evidence-order/
categories: [技术, 项目方法]
tags: [Linux BSP, Device Tree, 驱动, Bring-up]
---

板级适配最耗时间的地方，往往不是某个 API 不会用，而是硬件描述、运行镜像和驱动日志之间没有建立固定检查顺序。我的经验是先把原理图事实整理成资源表，再把每个事实映射到设备树和运行证据。

<div class="note-flow"><span>原理图资源</span><i>→</i><span>DTS 描述</span><i>→</i><span>运行 DTB</span><i>→</i><span>驱动匹配</span><i>→</i><span>真实功能</span></div>

<div class="note-map"><span><b>硬件事实</b><small>供电、时钟、复位与总线</small></span><span><b>软件描述</b><small>DTB 与驱动匹配</small></span><span><b>运行证据</b><small>日志、波形与真实读写</small></span></div>

## 编译成功只是起点

资源表至少包括供电、时钟、复位、引脚、总线地址和中断。DTS 能编译，不代表板子运行了这份 DTB；节点存在，也不代表 regulator、clock、reset 和 pinctrl 已经正确。probe 成功更不代表真实数据语义正确。

我通常按如下顺序检查：运行中的 DTB 与节点状态、compatible 与驱动配置、总线枚举和地址、供电与时钟、复位和引脚、中断计数，最后才是传输波形与数据含义。这个顺序能减少在上层反复修改、实际问题却停留在板级资源的情况。

## deferred probe 是线索

延迟 probe 常表示依赖尚未就绪，不应一看到就修改驱动。先找缺失的 provider、错误的 phandle 或模块加载顺序。错误路径也要保留准确 errno，便于区分“没有设备”“资源未就绪”和“通信失败”。

## 镜像必须作为整体交付

Kernel、DTB、模块和 RootFS 需要绑定版本。只替换其中一个文件，容易制造“源码已经改了，运行行为却没变”的错觉。可回滚镜像、构建指纹和启动日志是排障证据的一部分。

## 参考资料

- [Devicetree specification](https://devicetree-specification.readthedocs.io/en/stable/)
- [Linux driver model](https://www.kernel.org/doc/html/latest/driver-api/driver-model/)

## 证据边界

本文不涉及任何特定芯片的私有寄存器、原理图、GPIO 编号、板卡名称或厂商配置，仅总结通用 Bring-up 方法。
