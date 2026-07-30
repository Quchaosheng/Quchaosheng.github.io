---
title: RT-Thread FAL：统一管理片内与片外 Flash 分区
date: 2026-07-30 09:09:00
categories: [技术, RT-Thread]
tags: [FAL, Flash, 分区]
---

Flash Abstraction Layer 把不同 Flash 芯片抽象为统一设备，再用分区表定义 bootloader、应用、下载区、参数区和文件系统等逻辑区域。

<div class="note-flow"><span>注册片内/片外 Flash</span><i>→</i><span>加载分区表</span><i>→</i><span>按名称查找分区</span><i>→</i><span>统一 read/write/erase</span><i>→</i><span>上层 OTA/文件系统使用</span></div>

分区布局是产品 ABI，升级后不能随意变化；写入边界和擦除对齐必须在 FAL 层严格校验。参考：[FAL](https://github.com/RT-Thread-packages/fal)
