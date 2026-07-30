---
title: RT-Thread OTA：下载、校验、切换与回滚
date: 2026-07-30 09:10:00
categories: [技术, RT-Thread]
tags: [OTA, Bootloader, FAL]
---

OTA 将新固件下载到独立分区，完成长度、哈希和签名校验后设置升级标志，由 Bootloader 搬运或切换镜像并试启动。

<div class="note-flow"><span>断点下载到 download 分区</span><i>→</i><span>校验固件与签名</span><i>→</i><span>写入升级状态</span><i>→</i><span>Bootloader 切换并试启动</span><i>→</i><span>应用确认或自动回滚</span></div>

升级状态必须可恢复，任何一步掉电都不能让设备失去可启动镜像；还需防降级攻击。参考：[RT-Thread](https://github.com/RT-Thread/rt-thread)
