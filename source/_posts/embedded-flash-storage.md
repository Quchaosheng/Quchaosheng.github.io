---
title: 嵌入式 Flash 存储：擦写约束、掉电安全与磨损均衡
date: 2026-07-12 20:20:00
permalink: /2026/07/29/embedded-flash-storage/
categories: [技术, 嵌入式]
tags: [Flash, EasyFlash, 掉电保护]
---

Flash 写入前需要擦除，擦除粒度大且寿命有限。可靠参数存储应采用追加记录、版本号、校验和与双区切换，避免掉电留下半条有效数据。

<div class="note-flow"><span>生成新配置记录</span><i>→</i><span>写入数据与校验</span><i>→</i><span>原子提交有效标志</span><i>→</i><span>启动时扫描最新版本</span><i>→</i><span>后台回收旧扇区</span></div>

参考：[EasyFlash](https://github.com/armink/EasyFlash)
