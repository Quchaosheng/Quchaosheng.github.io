---
title: I2C 总线：寻址、时序与故障恢复
date: 2026-05-13 20:00:00
permalink: /2026/07/29/embedded-i2c/
categories: [技术, 嵌入式]
tags: [I2C, 总线, 驱动]
---

I2C 用开漏 SDA/SCL 和上拉电阻实现多设备共享。总线上的任何节点都只能主动拉低，释放后由上拉电阻恢复高电平。主机通过 SCL 为高时 SDA 的变化产生 START 和 STOP，再以地址、读写位、数据字节和 ACK 组织一笔事务。

<div class="note-flow"><span>START</span><i>→</i><span>地址+R/W</span><i>→</i><span>ACK</span><i>→</i><span>数据字节与 ACK</span><i>→</i><span>STOP</span></div>

<figure class="note-visual"><figcaption><span>信号图</span>逻辑层的每一个 ACK 都依赖正确的电气时序。</figcaption><div class="note-map"><span><b>上拉电阻</b><small>决定释放后的上升时间，过大或过小都会影响波形。</small></span><span><b>START/STOP</b><small>SCL 为高时 SDA 的下降和上升分别界定事务。</small></span><span><b>地址阶段</b><small>先核对 7 位或 10 位地址，不要把读写位算进地址。</small></span><span><b>ACK/NACK</b><small>第九个时钟由接收方拉低确认，NACK 也可能是正常结束。</small></span><span><b>重复起始</b><small>寄存器读常用它保持总线所有权，而不是先 STOP 再 START。</small></span><span><b>时钟拉伸</b><small>从机可拉低 SCL 延长处理时间，控制器超时需要覆盖这条路径。</small></span></div></figure>

## 先看波形，再怀疑驱动代码

枚举不到设备时，逻辑分析仪或示波器比继续改地址更快。先确认总线空闲时 SDA/SCL 都能到高电平，再看 START 后地址字节是否正确、ACK 是否在第九个时钟出现、上升沿是否过慢。常见错误包括把 7 位地址又左移一次、读写方向颠倒，以及没有处理设备要求的重复起始。

总线速率不是只改一个寄存器。线路长度、器件数量、电容和上拉值都会改变上升时间；若波形在高电平前还没有稳定，就算控制器寄存器配置成更高频率也无法可靠通信。

## 卡死恢复要有退出条件

设备在传输中复位时可能把 SDA 拉低。若硬件允许由主机控制 SCL，可以在确认没有其他主机活动后输出若干个时钟脉冲，让从机推进到可释放 SDA 的位置，再生成一个 STOP。9 个脉冲是常见做法，但不是万能修复；恢复失败时应复位 I2C 控制器，必要时复位从设备或上报故障，避免无限循环占满 CPU。

参考：[嵌入式资源汇总](https://github.com/ZhengNianLi/EmbedSummary)
