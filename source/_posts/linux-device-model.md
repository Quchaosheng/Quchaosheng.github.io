---
title: Linux 设备驱动模型：总线、设备和驱动如何相遇
date: 2026-07-29 13:19:00
categories: [技术, 嵌入式Linux]
tags: [设备模型, 驱动, sysfs]
---

Linux 设备模型用 bus、device、driver 和 class 统一描述硬件及其关系。它把“设备存在”和“谁来驱动”解耦，并通过 sysfs 向用户空间展示拓扑与属性。

## 匹配流程

设备由固件描述、枚举逻辑或板级代码注册到总线；驱动注册后，总线的 match 规则比较 compatible、ID 表等信息。匹配成功才调用 probe 建立资源、子系统接口和运行状态。

<div class="note-flow"><span>注册 device</span><i>→</i><span>注册 driver</span><i>→</i><span>总线执行 match</span><i>→</i><span>调用 probe</span><i>→</i><span>注册 class/子系统接口</span></div>

## 记忆要点

- bus 负责匹配规则，class 按功能组织设备，两者不是同一维度。
- probe 应正确处理资源申请失败和延迟探测。
- remove 路径必须按相反顺序释放已建立的资源。

参考：[从 0 到 1，带你吃透 Linux 设备驱动模型](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247495135&idx=1&sn=aceb59f8174c88b6846b3416a4f1cf6a)
