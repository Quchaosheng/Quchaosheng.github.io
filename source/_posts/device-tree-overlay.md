---
title: 设备树 Overlay：运行时修改硬件描述
date: 2026-07-29 13:46:00
categories: [技术, 嵌入式Linux]
tags: [设备树, Overlay, 驱动]
---

设备树 Overlay 用增量 DTBO 修改基础设备树，适合扩展板、可插拔硬件和同一主板的多种配置。Overlay 通过 fragment 指定目标节点，再添加、覆盖或禁用属性和子节点。

<div class="note-flow"><span>编译基础 DTB 与 DTBO</span><i>→</i><span>解析 fragment 目标</span><i>→</i><span>合并属性和节点</span><i>→</i><span>创建设备并触发 probe</span><i>→</i><span>卸载时按依赖回滚</span></div>

关键难点是符号引用、phandle 修正和生命周期。Overlay 不能随意删除正在被驱动使用的资源；卸载前必须确保设备、时钟、中断和引用者都能安全退出。

参考：[设备树 Overlay 机制深入拆解](https://tinylab.org/devicetree-overlay-internals/)
