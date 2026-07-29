---
title: bcachefs：写时复制文件系统的核心设计
date: 2026-07-29 13:59:00
categories: [技术, 文件系统]
tags: [bcachefs, COW, B树]
---

bcachefs 把 bcache 的缓存与多设备经验发展为通用写时复制文件系统，目标包括校验和、压缩、快照、复制和在线扩缩容。

<div class="note-flow"><span>应用修改文件</span><i>→</i><span>分配新数据与元数据位置</span><i>→</i><span>更新 B-tree 键</span><i>→</i><span>日志确保事务顺序</span><i>→</i><span>新根生效并回收旧空间</span></div>

COW 避免原地覆盖并利于快照，但会带来空间放大、碎片和回收压力。理解 bcachefs 应重点关注 B-tree 元数据、journal、一致性校验和多设备数据放置，而非只比较功能列表。

参考：[bcachefs 文件系统简介](https://tinylab.org/bcachefs-intro-part1)
