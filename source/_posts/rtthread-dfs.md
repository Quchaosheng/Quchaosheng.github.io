---
title: RT-Thread DFS：把不同存储统一为文件系统
date: 2026-07-30 09:05:00
categories: [技术, RT-Thread]
tags: [DFS, 文件系统, VFS]
---

DFS 提供类似 VFS 的统一接口，将设备、挂载点与 FAT、littlefs、RomFS 等具体文件系统连接起来，应用使用标准文件 API 访问不同介质。

<div class="note-flow"><span>块/MTD 设备注册</span><i>→</i><span>识别并挂载文件系统</span><i>→</i><span>路径解析到挂载点</span><i>→</i><span>调用具体文件系统操作</span><i>→</i><span>驱动完成介质 I/O</span></div>

Flash 文件系统要考虑掉电一致性和擦写寿命；热插拔介质还需管理打开文件与卸载竞态。参考：[RT-Thread](https://github.com/RT-Thread/rt-thread)
