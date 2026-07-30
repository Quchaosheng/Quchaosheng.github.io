---
title: cyclictest：怎样测量 Linux 实时调度延迟
date: 2026-07-11 14:00:00
permalink: /2026/07/30/cyclictest-latency/
categories: [技术, Linux实时]
tags: [cyclictest, 延迟测试, rt-tests]
---

`cyclictest` 是 Linux 实时测试里最常见的起点。它创建周期线程，记录计划唤醒时刻与线程真正恢复执行时刻的偏差。这个偏差覆盖了定时器到期、中断处理、调度器选择、CPU 被占用以及部分系统噪声，因此比单纯测一段用户态函数更接近“实时线程有没有按时醒来”。但它仍只是测量工具，不等于业务任务的端到端截止期证明。

<div class="note-flow"><span>设置实时优先级与 CPU</span><i>→</i><span>绝对时间睡眠</span><i>→</i><span>定时器到期唤醒</span><i>→</i><span>计算实际偏差</span><i>→</i><span>长期记录最大值</span></div>

## 它测到的数值是什么

若本次理应在 `T_expected` 醒来，实际开始执行的时刻是 `T_actual`，则可粗略写成：

```text
latency = T_actual - T_expected
```

最小值说明系统在顺利时的表现，平均值说明典型负载，最大值和直方图尾部则暴露最坏情况。实时工程通常优先关心后两者：一次 2 ms 尖峰就可能让 1 kHz 控制任务错过两个周期，即使平均延迟只有 10 微秒。

<div class="note-map"><span><b>周期</b><small>测试线程多久被期望唤醒一次，例如 1 ms</small></span><span><b>优先级</b><small>决定测试线程与普通工作谁先得到 CPU</small></span><span><b>亲和性</b><small>决定测试在什么 CPU 上观测系统噪声</small></span><span><b>运行时长</b><small>越长越可能捕获低频固件和热相关尖峰</small></span><span><b>直方图</b><small>观察长尾分布，避免只盯一条最大值</small></span><span><b>对照负载</b><small>CPU、内存、I/O、网络同时施压才有参考价值</small></span></div>

## 一条可复现的起步命令

先明确测试 CPU、周期、运行时长和日志路径。下面示例将单个测试线程固定到 CPU 2、优先级设为 90、间隔设为 1000 微秒，并运行十分钟；参数必须按你的 CPU 规划与权限限制调整。

```bash
sudo cyclictest -p 90 -t 1 -a 2 -i 1000 -D 10m -m -h 100
```

`-m` 会尝试锁定测试进程内存，可能因 `RLIMIT_MEMLOCK` 失败；`-h` 生成直方图，便于观察尾部。运行前应记录内核版本、PREEMPT_RT 状态、启动参数、功耗模式、CPU 亲和性、IRQ 布局和当前温度，否则两次数字没有可比性。

## 别让空闲测试骗过你

一轮完整测试至少应有四组：空闲基线、CPU 压力、内存/页回收压力、网络和磁盘 I/O 压力；有 GPU 或相机的机器人还要加入实际推理和采集负载。每组都跑到足以覆盖定时任务、温控和后台维护周期，并保留原始直方图。

```text
发现尖峰
  -> 记录发生时刻和 CPU
  -> 关联 /proc/interrupts、ftrace、rtla osnoise/timerlat
  -> 判断来自 IRQ、锁、缺页、频率、固件还是应用自身
  -> 修改一个变量后在同一负载下复测
```

如果 `cyclictest` 最大值下降了，业务仍可能超时，因为业务还包含传感器、队列、算法和执行器。反过来，`cyclictest` 出现尖峰也不等于业务必定失败。它的价值是提供可重复的“系统唤醒延迟”证据，并把问题缩小到可追踪的时间窗口。

参考：[rt-tests](https://git.kernel.org/pub/scm/utils/rt-tests/rt-tests.git/) · [cyclictest man page](https://manpages.debian.org/testing/rt-tests/cyclictest.8.en.html)
