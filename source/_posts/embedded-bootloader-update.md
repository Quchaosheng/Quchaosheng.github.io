---
title: 嵌入式 Bootloader：安全升级与失败回滚
date: 2026-06-15 14:00:00
permalink: /2026/07/29/embedded-bootloader-update/
categories: [技术, 嵌入式]
tags: [Bootloader, OTA, 回滚]
---

可靠升级系统使用签名验证、版本与防回滚策略、A/B 镜像或恢复分区。Bootloader 只启动已验证镜像，并通过启动计数或应用确认判断是否回滚。

<div class="note-flow"><span>下载到非活动分区</span><i>→</i><span>校验哈希与签名</span><i>→</i><span>标记待试启动</span><i>→</i><span>应用自检并确认</span><i>→</i><span>失败则回滚旧镜像</span></div>

参考：[OpenBLT](https://www.feaser.com/openblt/doku.php)
