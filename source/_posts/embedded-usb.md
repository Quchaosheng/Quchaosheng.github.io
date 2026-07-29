---
title: USB 设备枚举：主机如何识别一个新设备
date: 2026-07-29 14:29:00
categories: [技术, 嵌入式]
tags: [USB, 枚举, 描述符]
---

USB 由主机控制总线。设备接入后，主机复位端口、读取设备描述符、分配地址，再读取配置与接口描述符并选择驱动。

<div class="note-flow"><span>检测接入</span><i>→</i><span>端口复位</span><i>→</i><span>EP0 读取描述符</span><i>→</i><span>SET_ADDRESS</span><i>→</i><span>SET_CONFIGURATION 并启用端点</span></div>

枚举失败优先检查供电、D+/D-、时钟精度、EP0 最大包和描述符长度。参考：[DAPLink](https://github.com/ARMmbed/DAPLink)
