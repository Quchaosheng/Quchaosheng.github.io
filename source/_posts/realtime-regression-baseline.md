---
title: 实时回归测试：把一次调优变成可持续的延迟基线
date: 2026-07-22 20:00:00
permalink: /2026/07/30/realtime-regression-baseline/
categories: [技术, Linux实时]
tags: [cyclictest, 回归测试, 延迟基线]
---

实时性会被看似无关的改动悄悄破坏：内核升级、网卡驱动、BIOS、容器配置、日志服务、模型版本、散热策略甚至办公室温度都可能改变长尾。一次成功调优如果没有留下环境、负载和原始数据，下一次尖峰出现时只能从头猜。实时回归测试的价值是把“那天跑得很好”变成可复现、可比较、可阻止回归的工程基线。

<div class="note-flow"><span>定义负载与通过阈值</span><i>→</i><span>记录软硬件环境</span><i>→</i><span>长时间组合压测</span><i>→</i><span>比较尾延迟与直方图</span><i>→</i><span>超阈值后保留追踪证据</span></div>

## 基线不是一个最大值

单个 `max=37 us` 无法说明测试跑了多久、在什么负载下、是否刚好没碰到低频事件。一个有用的基线至少包含：最小/平均/最大值、P95/P99/P99.9、直方图、超过阈值的次数、连续运行时长，以及业务端到端指标，例如相机帧年龄或控制周期 miss 数。

<div class="note-map"><span><b>测试描述</b><small>周期、CPU、优先级、负载、时长和通过阈值</small></span><span><b>环境快照</b><small>内核、firmware、启动参数、温度、频率、IRQ 与容器配置</small></span><span><b>原始数据</b><small>cyclictest/rtla 输出、直方图、业务时间戳</small></span><span><b>失败证据</b><small>trace、/proc/interrupts、osnoise、日志和复现步骤</small></span><span><b>比较规则</b><small>与同硬件同负载基线比尾部和超阈值次数</small></span><span><b>版本门禁</b><small>超阈值阻止镜像、内核或配置进入下一阶段</small></span></div>

## 先固定测试矩阵

测试矩阵应覆盖最可能制造噪声的维度，而不是无穷排列。常见的组合包括：空载、CPU 压力、内存压力、磁盘 I/O、网络满载、相机/GPU 推理、热稳定和服务重启。对于机器人，还应加入传感器断流、消息积压、控制器取消和安全恢复。

```text
每个 case = 固定硬件 + 固定镜像 + 固定启动参数
          + 固定 CPU/IRQ 布局 + 固定负载脚本 + 固定运行时长
          -> 输出原始延迟数据、环境快照、pass/fail 和异常 trace
```

这样一次结果变坏时，首先能比较的是“什么变了”，而不是先争论测试是不是可信。

## 把时间戳和环境一起收集

测试脚本启动时保存 `uname -a`、内核 config、CPU governor、温度、`/proc/interrupts`、cgroup/cpuset 与应用版本；运行中保存周期延迟、工作集、丢帧/超时和系统日志。超阈值时自动抓取较短的 ftrace/rtla 证据，而不是依赖人恰好在终端前。

长尾比较最好同时看数值和形状：最大值偶尔变化可能是采样机会不同；直方图整体右移、P99 持续升高或超阈值次数增加，通常更能说明系统发生了真实退化。阈值也应分级，例如 warning 用于调查，fail 用于阻止发布。

## 让回归测试进入交付流程

在有固定硬件的实验台或 HIL 环境上，将测试作为镜像、内核、驱动和 BIOS 变更的门禁。自动化并不意味着完全无人值守：一旦失败，应保留硬件状态、trace 和复现脚本，供工程师判断是环境噪声、测试缺陷还是产品风险。

最终目标不是让图表永远完美，而是让每一次变差都有证据、每一次优化能留下基线、每一次版本升级都知道自己是否仍满足 deadline。

参考：[rt-tests](https://wiki.linuxfoundation.org/realtime/documentation/howto/tools/rt-tests) · [rtla](https://docs.kernel.org/tools/rtla/index.html)
