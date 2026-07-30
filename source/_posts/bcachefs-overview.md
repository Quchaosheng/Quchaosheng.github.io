---
title: bcachefs：写时复制文件系统的核心设计
date: 2026-03-30 14:00:00
permalink: /2026/07/29/bcachefs-overview/
categories: [技术, 文件系统]
tags: [bcachefs, COW, B树]
---

bcachefs 把 bcache 的缓存与多设备经验发展为通用写时复制文件系统，目标包括校验和、压缩、快照、复制和在线扩缩容。它的核心不是堆很多功能，而是用新的数据和元数据位置构造一次事务，再让新的根在一致的时机可见，避免原地覆盖把旧状态和新状态混在一起。

<div class="note-flow"><span>应用修改文件</span><i>→</i><span>分配新数据与元数据位置</span><i>→</i><span>更新 B-tree 键</span><i>→</i><span>日志确保事务顺序</span><i>→</i><span>新根生效并回收旧空间</span></div>

<figure class="note-visual"><figcaption><span>事务图</span>COW 写入保留旧版本，提交后再让新元数据指向新位置。</figcaption><div class="note-map"><span><b>新数据块</b><small>修改内容写到新位置，旧块在提交前仍可被旧版本引用。</small></span><span><b>B-tree 键</b><small>将逻辑范围映射到物理位置，是文件数据和元数据索引基础。</small></span><span><b>journal</b><small>记录事务顺序，帮助崩溃恢复判断哪些更新已经提交。</small></span><span><b>校验和</b><small>验证数据或元数据读回是否仍完整，错误处理要有明确策略。</small></span><span><b>快照</b><small>多个根可引用相同旧数据，写入时再分叉。</small></span><span><b>回收</b><small>旧引用消失后才能释放空间，清理和碎片整理会消耗资源。</small></span></div></figure>

## COW 换来一致性，也带来写放大

每次小修改可能需要写新数据、更新多个 B-tree 节点并记录日志。这样可以保留旧版本、支持快照和更安全的崩溃恢复，却也可能增加空间使用、碎片和后台回收压力。评估文件系统时要看实际工作负载中的写放大、尾延迟和可用空间，而不是只比较是否支持压缩或快照。

## 多设备语义要和故障模型一起看

校验和、复制和多设备放置能提高发现和处理介质错误的能力，但不同布局对单盘故障、掉电、扩容和替换盘的恢复方式不同。测试前应明确哪些数据有多少副本、日志在哪些设备上、空间不足时会发生什么。任何文件系统功能都不能替代备份和恢复演练。

参考：[bcachefs 文件系统简介](https://tinylab.org/bcachefs-intro-part1)
