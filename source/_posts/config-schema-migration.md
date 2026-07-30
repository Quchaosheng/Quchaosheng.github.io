---
title: 设备参数版本迁移：固件升级后怎样保住旧配置
date: 2026-07-19 14:10:00
permalink: /2026/07/29/config-schema-migration/
categories: [技术, 嵌入式]
tags: [配置, 版本迁移, Flash]
---

持久化配置应包含 magic、结构版本、长度和校验。新固件加载旧版本时逐级迁移到新结构，再以掉电安全方式写回。

<div class="note-flow"><span>读取配置头</span><i>→</i><span>校验 magic/长度/CRC</span><i>→</i><span>识别 schema 版本</span><i>→</i><span>逐级迁移并补默认值</span><i>→</i><span>原子保存新版本</span></div>

不要直接把 C 结构体裸写 Flash，填充、字节序和字段变化都会破坏兼容。参考：[EasyFlash](https://github.com/armink/EasyFlash)
