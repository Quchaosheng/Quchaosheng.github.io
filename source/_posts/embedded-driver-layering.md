---
title: 嵌入式驱动分层：BSP、HAL 与设备服务
date: 2026-06-10 14:00:00
permalink: /2026/07/29/embedded-driver-layering/
categories: [技术, 嵌入式]
tags: [BSP, HAL, 驱动架构]
---

驱动分层不是为了多写几层目录，而是让板卡变化、芯片库升级和器件替换不会一路传到业务逻辑。寄存器、时钟、DMA 和引脚复用属于最底层；温度传感器、Flash、屏幕等器件协议位于中间；上层只应看到稳定的“读取温度”“保存配置”“发送一帧”这类能力。

<div class="note-flow"><span>寄存器与引脚 BSP</span><i>→</i><span>统一 HAL 接口</span><i>→</i><span>器件协议驱动</span><i>→</i><span>设备服务与缓存</span><i>→</i><span>业务逻辑</span></div>

<figure class="note-visual"><figcaption><span>边界图</span>每层都有明确的资源所有权和可测试范围。</figcaption><div class="note-map"><span><b>BSP</b><small>描述板级时钟、引脚、DMA、复位和供电顺序。</small></span><span><b>HAL</b><small>包装具体 MCU 外设的读写、传输和错误返回。</small></span><span><b>器件驱动</b><small>实现传感器寄存器、Flash 命令或显示协议。</small></span><span><b>设备服务</b><small>处理缓存、重试、状态机和对业务的语义化接口。</small></span><span><b>业务层</b><small>只关心任务目标，不持有厂商句柄和寄存器地址。</small></span><span><b>测试替身</b><small>在 HAL 或服务边界替换依赖，主机即可测试大部分逻辑。</small></span></div></figure>

## 接口要表达业务语义和失败方式

上层调用 `sensor_read()`、`storage_commit()` 这类接口，比直接传递 `HAL_I2C_HandleTypeDef` 更容易理解。接口的返回值也要能区分超时、校验失败、设备不存在和暂时忙碌，不能把所有异常压成一个布尔值。这样重试、降级和告警才能由合适的层处理。

底层并不是越薄越好。DMA 缓冲区归谁管理、异步传输何时完成、复位后是否需要重新初始化，这些资源规则需要在接口处写清楚，否则“分层”只会把竞态藏得更深。

## 测试从上往下逐层收缩

器件驱动可以通过模拟总线读写测试寄存器序列和错误路径；服务层可用 mock 验证重试和状态转换；最后才在目标板检查时钟、电平和真实时序。板子问题和业务问题被分开后，定位速度通常比把所有代码都塞进一个 `main.c` 快得多。

参考：[AMetal](https://github.com/zlgopen/ametal)
