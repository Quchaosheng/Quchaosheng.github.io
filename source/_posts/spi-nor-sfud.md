---
title: SPI NOR Flash：从 JEDEC ID 到通用驱动
date: 2026-06-27 14:00:00
permalink: /2026/07/29/spi-nor-sfud/
categories: [技术, 嵌入式]
tags: [SPI-NOR, SFUD, Flash]
---

通用 SPI NOR 驱动先读取 JEDEC ID 与参数，确定容量、页大小、擦除粒度和支持命令，再提供读、页编程、扇区擦除与忙状态轮询。

<div class="note-flow"><span>读取 JEDEC ID</span><i>→</i><span>解析器件参数</span><i>→</i><span>写使能</span><i>→</i><span>页编程/扇区擦除</span><i>→</i><span>轮询 WIP 并校验</span></div>

写入不可跨页，擦除期间掉电可能破坏整个扇区；上层需配合日志或双区提交。参考：[SFUD](https://github.com/armink/SFUD)
