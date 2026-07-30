---
title: I2C 总线：寻址、时序与故障恢复
date: 2026-06-17 20:00:00
permalink: /2026/07/29/embedded-i2c/
categories: [技术, 嵌入式]
tags: [I2C, 总线, 驱动]
---

I2C 用开漏 SDA/SCL 和上拉电阻实现多设备共享。主机发送起始条件、地址与读写位，接收方逐字节 ACK，最后以停止条件结束事务。

<div class="note-flow"><span>START</span><i>→</i><span>地址+R/W</span><i>→</i><span>ACK</span><i>→</i><span>数据字节与 ACK</span><i>→</i><span>STOP</span></div>

调试重点是上拉、地址位宽、时钟拉伸和重复起始。SDA 被从机拉低时，可尝试输出 9 个 SCL 脉冲并重新产生 STOP。参考：[嵌入式资源汇总](https://github.com/ZhengNianLi/EmbedSummary)
