---
title: RT-Thread 设备框架：统一访问不同硬件
date: 2026-07-30 09:03:00
categories: [技术, RT-Thread]
tags: [设备框架, 驱动, RT-Thread]
---

RT-Thread 将 UART、SPI、I2C、传感器等注册为 `rt_device`，应用通过 find、open、read/write、control 和 close 使用统一接口，底层驱动负责具体硬件操作。

<div class="note-flow"><span>驱动创建并注册设备</span><i>→</i><span>应用按名称查找</span><i>→</i><span>open 配置模式</span><i>→</i><span>read/write/control</span><i>→</i><span>close 与资源释放</span></div>

应用不应越过设备框架直接操作厂商句柄，否则移植、测试与功耗管理都会变困难。参考：[RT-Thread](https://github.com/RT-Thread/rt-thread)
