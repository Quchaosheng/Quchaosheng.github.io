---
title: 实时回归测试：把一次调优变成可持续的延迟基线
date: 2026-07-30 09:29:00
categories: [技术, Linux实时]
tags: [cyclictest, 回归测试, 延迟基线]
---

实时性可能被内核配置、驱动、BIOS、容器参数甚至温度策略悄悄改变。可靠做法是固定硬件与测试矩阵，保存原始直方图、最大值、分位数和环境信息，让每次系统升级都能与已知基线比较。
<div class="note-flow"><span>定义负载与通过阈值</span><i>→</i><span>记录软硬件环境</span><i>→</i><span>长时间组合压测</span><i>→</i><span>比较尾延迟与直方图</span><i>→</i><span>超阈值后保留追踪证据</span></div>

测试应覆盖空载、CPU/内存/网络/存储压力和温度稳定后的场景，并把失败时的 ftrace 或 rtla 数据作为构建产物。只保存一个“最好结果”无法阻止回归。参考：[rt-tests](https://wiki.linuxfoundation.org/realtime/documentation/howto/tools/rt-tests)
