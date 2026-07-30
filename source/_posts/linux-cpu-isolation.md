---
title: CPU 隔离：为实时任务留出安静的核心
date: 2026-07-09 14:00:00
permalink: /2026/07/30/linux-cpu-isolation/
categories: [技术, Linux实时]
tags: [CPU隔离, nohz_full, rcu_nocbs]
---

把实时线程绑到一个 CPU，不代表这个 CPU 上只有它。调度 tick、RCU 回调、workqueue、IRQ、内存回收、内核线程和固件活动都可能抢时间。CPU 隔离要做的是把系统杂务放到 housekeeping CPU，把关键线程和必要设备路径留给实时 CPU，再检查还有哪些干扰没移走。

<div class="note-flow"><span>划分实时与 housekeeping CPU</span><i>→</i><span>迁移 IRQ 和内核线程</span><i>→</i><span>配置 nohz_full/rcu_nocbs</span><i>→</i><span>绑定实时任务</span><i>→</i><span>追踪残余干扰</span></div>

## 隔离的对象比“进程”多得多

`nohz_full` 让满足条件的 CPU 尽可能停止周期调度 tick；`rcu_nocbs` 将 RCU 回调从指定 CPU 卸载到其他 CPU；cpuset/cgroup 和 `taskset` 则用来约束应用线程。它们各自解决不同的噪声来源，缺一项都可能让测试中留下规律性的尖峰。

<div class="note-map"><span><b>实时 CPU</b><small>控制线程、必要驱动路径、已锁定的资源</small></span><span><b>housekeeping CPU</b><small>系统服务、日志、网络后台、RCU 与 workqueue</small></span><span><b>nohz_full</b><small>尽量减少无任务时的周期 tick 干扰</small></span><span><b>rcu_nocbs</b><small>将 RCU callback 扔给指定的非实时 CPU</small></span><span><b>IRQ 布局</b><small>把无关设备中断从实时 CPU 移走</small></span><span><b>应用亲和性</b><small>明确每个关键线程在哪个 CPU 上运行</small></span></div>

一个常见的做法是让 CPU 0-1 做 housekeeping，CPU 2-3 承担实时负载，例如 `nohz_full=2-3 rcu_nocbs=2-3`。是否还需要 `isolcpus`、如何设置 IRQ 默认亲和性，取决于内核版本、cgroup 管理方式和设备拓扑；不要直接复制别人的完整命令行就上生产。

## 从“绑定”开始，而不是从启动参数开始

先画出 CPU 规划：哪些线程必须准时、哪些中断必须靠近设备、哪些服务可以接受延迟。然后用 `taskset` 或 cpuset 把关键线程固定，使用 `ps` 查看它们是否真的停在预期 CPU，再处理 IRQ 和后台核。

```bash
# 查看线程调度类、实时优先级与当前所在 CPU
ps -eLo pid,tid,psr,cls,rtprio,comm | sort -k3,3n

# 查看每个 CPU 收到的中断，排查实时核上不该出现的设备
cat /proc/interrupts
```

CPU 亲和性会变。热插拔、容器 cgroup、服务重启、`irqbalance` 和启动脚本都可能改掉布局。开机和回归测试时都检查一次，比手工调通一次更有用。

## 为什么隔离后还会有尖峰

隔离不能消除共享 LLC、内存带宽、SMI、深度 C-state、DMA 竞争和设备固件。它也不能让一个实时线程在自己的 CPU 上无限计算而不影响系统。正确做法是先用隔离削掉可控噪声，再用 `rtla osnoise`、ftrace、`/proc/interrupts` 和业务日志解释剩余尖峰。

验收时要在正常负载、网络满载、磁盘 I/O、内存压力和热稳定状态下都复测。实时 CPU 真正“安静”的标准不是看起来没有普通进程，而是关键任务的最长唤醒/执行时间在所有预期工况下都可接受。

参考：[NO_HZ: The Linux Kernel Tick](https://docs.kernel.org/timers/no_hz.html) · [RCU NO-CBs](https://docs.kernel.org/RCU/rcu_nocb.html)
