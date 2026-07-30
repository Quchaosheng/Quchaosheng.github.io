---
title: 容器里的实时任务：cgroup、权限和 CPU 配额如何共同生效
date: 2026-07-30 09:26:00
categories: [技术, Linux实时]
tags: [cgroup, 容器, CAP_SYS_NICE]
---

容器共享宿主机内核，实时调度能力仍受 `CAP_SYS_NICE`、`RLIMIT_RTPRIO`、cpuset 和 CPU 带宽控制约束。即使进程成功设置 `SCHED_FIFO`，过小的 CPU 配额、共享核上的宿主任务或未隔离的 IRQ 仍会制造延迟。
<div class="note-flow"><span>授予最小调度权限</span><i>→</i><span>配置 cpuset 与内存节点</span><i>→</i><span>核对 CPU/RT 预算</span><i>→</i><span>迁移宿主 IRQ 与杂务</span><i>→</i><span>在容器内外联合压测</span></div>

实时容器不是额外一层实时内核，它只是进程隔离和资源治理方式。排障时必须同时检查容器配置、cgroup 层级与宿主机调度状态。参考：[Control Group v2](https://docs.kernel.org/admin-guide/cgroup-v2.html) · [sched(7)](https://man7.org/linux/man-pages/man7/sched.7.html)
