---
title: Linux 内存泄漏排查：先分清是哪一种内存增长
date: 2026-07-29 16:09:18
source_checked_at: 2026-07-29 16:09:18
permalink: /2026/07/29/linux-memory-leak-diagnosis/
categories: [技术, 调试]
tags: [内存泄漏, RSS, Valgrind, Sanitizer]
---

“内存占用变大”不等于“发生泄漏”。进程 RSS 增长可能来自真正不可达的堆对象、仍被引用的缓存、内存映射、线程栈、共享内存，或分配器尚未归还的空闲页。排查第一步是确定增长属于哪一类。

## 诊断路径

先用系统指标确认增长进程和时间段，再分析 `/proc/<pid>/smaps` 区分匿名页、文件映射与共享页。能复现时使用 ASan、LSan、Valgrind 或 heap profiler 定位分配栈；线上则优先采用低开销采样和趋势对比。

<div class="note-flow"><span>监控发现 RSS 增长</span><i>→</i><span>确认增长是否持续</span><i>→</i><span>用 smaps 分类内存</span><i>→</i><span>采样分配调用栈</span><i>→</i><span>复现、修复并回归验证</span></div>

## 工具与判断

- `ps`, `top`, `pidstat -r`：观察进程级趋势。
- `/proc/PID/status`, `smaps`, `smaps_rollup`：拆分 RSS、PSS 与映射类型。
- ASan/LSan：适合测试环境快速定位泄漏和越界。
- Valgrind Memcheck：信息丰富但运行开销较高。
- heap profiler/eBPF：适合观察长期运行服务的分配热点。

必须用同样负载做修复前后对比，并观察内存是否达到稳定平台。只看某个时间点，容易把缓存预热误判为泄漏。

参考：[Linux 如何查找内存泄漏和内存占用过大？](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247489493&idx=1&sn=30c6465407868a9aa55ad3e27234fc4c)
