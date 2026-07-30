---
title: RCU：读多写少场景下的并发设计
date: 2026-07-29 16:09:18
source_checked_at: 2026-07-29 16:09:18
permalink: /2026/07/29/linux-rcu/
categories: [技术, Linux内核]
tags: [RCU, 并发, 同步]
---

RCU（Read-Copy-Update）让读者在极低同步成本下访问共享数据。写者不原地破坏旧版本，而是创建新版本、发布新指针，并等待所有旧读者离开后再回收旧对象。

## 更新流程

读侧进入 RCU 临界区并解引用指针；写侧复制并修改对象，再原子发布。经过 grace period 后，可确认此前的读侧临界区都已结束，旧对象才安全释放。

<div class="note-flow"><span>读者读取旧指针</span><i>→</i><span>写者复制并修改</span><i>→</i><span>原子发布新指针</span><i>→</i><span>等待宽限期</span><i>→</i><span>回收旧对象</span></div>

## 记忆要点

- RCU 优化读路径，代价是写逻辑和回收机制更复杂。
- `rcu_read_lock()` 不等同于普通互斥锁。
- `synchronize_rcu()` 等待的是旧读者结束，不是等待所有 CPU 空闲。

参考：[不懂 RCU，别再说你懂 Linux 内核了](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494641&idx=1&sn=e4180c6d497c4153f19276c5adc126b6)
