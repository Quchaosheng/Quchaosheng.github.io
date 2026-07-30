---
title: 嵌入式驱动分层：BSP、HAL 与设备服务
date: 2026-07-04 14:00:00
permalink: /2026/07/29/embedded-driver-layering/
categories: [技术, 嵌入式]
tags: [BSP, HAL, 驱动架构]
---

驱动分层把寄存器与板级资源放在 BSP/HAL，把器件协议封装为设备驱动，再向业务提供稳定服务接口，从而隔离芯片和板卡变化。

<div class="note-flow"><span>寄存器与引脚 BSP</span><i>→</i><span>统一 HAL 接口</span><i>→</i><span>器件协议驱动</span><i>→</i><span>设备服务与缓存</span><i>→</i><span>业务逻辑</span></div>

接口应表达能力和错误语义，不要把供应商句柄渗透到业务层。参考：[AMetal](https://github.com/zlgopen/ametal)
