---
title: EEVDF：从公平调度到虚拟截止时间
date: 2026-07-29 16:09:18
source_checked_at: 2026-07-29 16:09:18
permalink: /2026/07/29/linux-eevdf-scheduler/
categories: [技术, Linux内核]
tags: [EEVDF, 调度器, Linux]
description: 解释 EEVDF 怎样用 lag 保持权重公平，再用虚拟截止时间在合格任务中选择下一位运行者。
---

传统 CFS 常被概括成“选择 `vruntime` 最小的任务”。这个模型容易理解长期公平，却不方便直接表达一次请求的服务期限。Linux 6.6 开始在公平调度类中采用 EEVDF。它仍以虚拟时间和权重为基础，但把选择过程拆成两问：任务现在是否有资格运行，如果有，谁的虚拟截止时间更早。

EEVDF 不是 `SCHED_DEADLINE`。这里的 deadline 是公平调度器内部的虚拟截止时间，不是应用向内核承诺的硬实时期限。

## lag 先判断谁还欠服务

可以把每个任务想成按权重领取 CPU 份额。它实际得到的服务比理想份额少，lag 表示它仍“欠着”；若已经超额运行，就暂时不应继续占便宜。内核用虚拟时间表达这笔账，并从满足 eligibility 的任务中继续选择。

<div class="note-flow"><span>更新运行队列虚拟时间</span><i>→</i><span>计算各任务 lag</span><i>→</i><span>筛出 eligible 任务</span><i>→</i><span>比较虚拟截止时间</span><i>→</i><span>运行并扣减本次服务</span></div>

<div class="note-map"><span><b>权重</b><small>来自 nice 或组调度配置，决定长期公平份额</small></span><span><b>虚拟时间</b><small>把不同权重任务映射到可比较的公平进度</small></span><span><b>lag</b><small>任务应得服务与已得服务之间的虚拟差额</small></span><span><b>eligibility</b><small>阻止已超额任务继续优先消耗 CPU</small></span><span><b>request/slice</b><small>任务这次希望获得的服务量，影响虚拟期限</small></span><span><b>virtual deadline</b><small>合格任务中的排序依据，越早越先运行</small></span></div>

仅按 lag 选择，多个都欠服务的任务之间仍缺少明确顺序。EEVDF 根据任务虚拟起点和请求长度计算虚拟截止时间。在其他条件相近时，较短请求得到更早期限，因此睡眠后唤醒、服务时间短的交互任务更可能尽快完成一次运行，同时 eligibility 继续约束长期公平。

## 为什么要保留滞后时间

任务睡眠或暂时离开运行队列时，如果立刻抹掉它的历史状态，会产生两类问题：任务可能通过频繁睡眠逃避公平记账，也可能因为等待事件而失去原本合理的服务份额。EEVDF 使用 lag decay 处理离队任务的滞后状态，使它随虚拟时间变化逐步衰减，而不是简单清零。

这也是阅读调度器代码时容易困惑的地方。任务“不可运行”不代表所有调度状态都可以马上删除。唤醒延迟、抢占和放置规则都要与这段历史配合。

## 怎样观察，而不是猜

先确认系统版本和可用调度特性：

```bash
uname -r
grep -E 'CONFIG_SCHED_DEBUG|CONFIG_SCHEDSTATS' /boot/config-$(uname -r)
cat /proc/sched_debug 2>/dev/null | head -n 40
```

再用跟踪观察真实的唤醒、切换和迁移：

```bash
sudo trace-cmd record -e sched:sched_wakeup -e sched:sched_switch -e sched:sched_migrate_task -- sleep 10
trace-cmd report | less

# 或查看任务等待与运行时间线
sudo perf sched record -- ./workload
sudo perf sched timehist
```

要比较交互延迟，应构造明确负载，例如一个周期性短任务和若干 CPU 密集任务，并记录短任务从唤醒到开始运行的分布。只看平均 CPU 使用率无法判断选择策略是否改善了尾延迟。

## 与几个常见概念分开

- `vruntime` 仍然有用。EEVDF 是在公平虚拟时间之上增加 eligibility 与 deadline 选择，不是抛弃公平记账。
- EEVDF 的虚拟 deadline 不提供硬实时保证。中断关闭、锁竞争和更高优先级调度类都能延迟任务。
- nice 仍影响权重和长期份额，不直接指定一个固定时间片。
- 调度实体可能代表进程，也可能代表 cgroup 层级。组调度会让观察结果多一层权重分配。
- 不同内核小版本持续调整放置、抢占和 slice 行为，不能用一篇概念说明替代目标源码。

## 证据边界

本文解释 EEVDF 的选择框架，没有复述某一内核版本的全部实现条件。内核配置、调度特性开关、cgroup、CPU 拓扑与实时调度类都会改变结果。`/proc/sched_debug` 也不保证在所有发行版开放。需要定位线上延迟时，应保存内核 commit、启动参数、任务策略和调度 trace。

参考：[EEVDF Scheduler](https://docs.kernel.org/scheduler/sched-eevdf.html) · [CFS Scheduler](https://docs.kernel.org/scheduler/sched-design-CFS.html) · [sched(7)](https://man7.org/linux/man-pages/man7/sched.7.html) · [不懂 EEVDF 调度器，别再说你懂 Linux 内核了](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494601&idx=1&sn=28033289323ccab803c6d09a321f5d55)
