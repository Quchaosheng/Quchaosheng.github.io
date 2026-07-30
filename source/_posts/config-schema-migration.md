---
title: 设备参数版本迁移：固件升级后怎样保住旧配置
date: 2026-06-04 14:00:00
permalink: /2026/07/29/config-schema-migration/
categories: [技术, 嵌入式]
tags: [配置, 版本迁移, Flash]
---

固件升级后最容易被忽略的兼容问题，往往不是协议，而是设备里已经保存的参数。把 C 结构体原样写进 Flash 看似省事，字段新增、对齐方式变化或枚举含义调整后，旧数据就可能被新程序误读。持久化数据需要把格式本身当作一个长期维护的接口。

<div class="note-flow"><span>读取配置头</span><i>→</i><span>校验 magic/长度/CRC</span><i>→</i><span>识别 schema 版本</span><i>→</i><span>逐级迁移并补默认值</span><i>→</i><span>原子保存新版本</span></div>

<figure class="note-visual"><figcaption><span>存储布局</span>有效配置必须同时说明“它是什么、版本是多少、有没有写完”。</figcaption><div class="note-map"><span><b>magic</b><small>区分空白扇区、其他数据和本产品配置。</small></span><span><b>schema version</b><small>让新程序知道应该走哪一条迁移路径。</small></span><span><b>payload length</b><small>拒绝长度异常的数据，避免按错误边界解析。</small></span><span><b>CRC</b><small>检测掉电或存储损坏造成的半条记录。</small></span><span><b>默认值</b><small>新字段必须有可解释的缺省行为。</small></span><span><b>提交标记</b><small>最后写入，启动时只选择已完整提交的记录。</small></span></div></figure>

## 迁移要一版一版走

加载配置后，先校验头部，再根据版本调用明确的迁移函数，例如 `v1_to_v2()`、`v2_to_v3()`。每一步只处理本次版本变化，新增字段填默认值，已废弃字段丢弃或转换。这样排查异常时能知道是哪一次升级改变了数据，而不是让一个“大迁移函数”猜所有历史格式。

内存中的配置对象可以使用当前固件的结构；落盘格式则应使用固定宽度整数、明确的序列化顺序和独立的版本定义。浮点数、指针、位域和编译器填充都不适合直接作为长期存储格式。

## 写回时先写新记录，再切换有效标记

掉电安全的做法是保留旧记录，向新的槽位写入完整 payload 和校验，确认可读后再写入提交标记或更新选择指针。启动时在有效记录中选择序号最新的一条。这样即使电源在写入中断开，旧配置仍可用；不要先擦掉唯一的好记录再开始写新数据。

参考：[EasyFlash](https://github.com/armink/EasyFlash)
