---
title: RCU：读多写少场景下的并发设计
date: 2026-04-09 20:00:00
source_checked_at: 2026-07-29 16:09:18
permalink: /2026/07/29/linux-rcu/
categories: [技术, Linux内核]
tags: [RCU, 并发, 同步]
description: 用发布、宽限期和延迟回收解释 RCU，区分读侧保护、对象生命周期与写者之间的同步。
---

RCU（Read-Copy-Update）适合“读取极频繁、更新相对少”的共享数据。它把问题拆成两部分：读者怎样看到一个完整版本，以及旧版本什么时候可以释放。读侧通常不需要争用同一把锁；写侧准备新状态并发布指针，随后把旧对象的回收推迟到宽限期之后。

## 三件事不能混在一起

1. **发布可见性**：写者先初始化对象，再用 `rcu_assign_pointer()` 发布；读者用 `rcu_dereference()` 取得受保护的指针。
2. **读侧生命周期**：读者在 `rcu_read_lock()` 与 `rcu_read_unlock()` 之间使用对象，不能把裸指针带出保护范围后继续访问。
3. **延迟回收**：`synchronize_rcu()` 或 `call_rcu()` 等待/安排宽限期后处理旧对象。宽限期只保证旧读者已经离开，不自动解决写者之间的竞争。

<div class="note-flow"><span>读者读取旧指针</span><i>→</i><span>写者复制并修改</span><i>→</i><span>原子发布新指针</span><i>→</i><span>等待宽限期</span><i>→</i><span>回收旧对象</span></div>

<div class="note-map"><span><b>读侧临界区</b><small>保护对象仍可访问，不是普通互斥锁</small></span><span><b>发布</b><small>保证读者不会看到未初始化完成的版本</small></span><span><b>宽限期</b><small>开始等待前的读者都已离开</small></span><span><b>回调</b><small>call_rcu 异步安排旧对象回收</small></span><span><b>写者锁</b><small>多个写者仍可能需要 mutex/spinlock</small></span><span><b>RCU 变体</b><small>可睡眠条件与 quiescent state 规则不同</small></span></div>

## 一个典型骨架

下面只展示生命周期关系，错误处理和并发写者保护仍需按对象设计：

```c
rcu_read_lock();
p = rcu_dereference(global_ptr);
if (p)
    consume(p);
rcu_read_unlock();

new = clone_and_update(old);
rcu_assign_pointer(global_ptr, new);
synchronize_rcu();
kfree(old);
```

如果更新路径不能阻塞，可以把最后两步改为 `call_rcu()`，由回调在宽限期后释放。频繁更新时，还要控制待回收对象积压，不能把“异步释放”理解成“没有内存压力”。

## 如何观察与排错

内核调试配置提供 RCU stall 检测与 `rcutorture`。出现 stall 警告时，应保存完整日志、CPU 堆栈和内核配置，检查长时间关闭抢占/中断、CPU 未报告静止状态或读侧临界区异常延长等情况。

```bash
zgrep -E 'CONFIG_RCU|CONFIG_RCU_STALL' /proc/config.gz 2>/dev/null
dmesg -T | grep -i -E 'rcu.*stall|rcu_sched|rcu_preempt'
```

这些日志只能提示 RCU 无法推进，不能单独证明某个业务对象存在 use-after-free。对象生命周期问题仍需结合 KASAN、lockdep、崩溃栈和具体更新路径判断。

## 常见误区

- `rcu_read_lock()` 不负责排斥写者，也不让对象内容自动变成不可变。
- `synchronize_rcu()` 等待的是进入当前宽限期之前的读者，不是等待所有 CPU 空闲。
- RCU 保护“是否仍能访问”，引用计数保护“还有多少长期持有者”，二者解决的问题不同。
- 不同 RCU 变体对能否阻塞、怎样报告静止状态有不同规则，不能机械替换 API。

## 证据边界

本文描述 Linux 内核中常见的 RCU 使用模型，不覆盖所有 RCU 变体和内存序细节。真正修改内核路径时，应以对应内核版本的 RCU 文档、锁规则和 lockdep/KCSAN 结果为准。

参考：[What is RCU?](https://docs.kernel.org/RCU/whatisRCU.html) · [RCU concepts](https://docs.kernel.org/RCU/index.html) · [不懂 RCU，别再说你懂 Linux 内核了](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494641&idx=1&sn=e4180c6d497c4153f19276c5adc126b6)
