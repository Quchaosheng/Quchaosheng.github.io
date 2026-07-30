---
title: procfs：把内核运行状态投影成文件
date: 2026-07-29 17:36:41
source_checked_at: 2026-07-29 17:36:41
permalink: /2026/07/29/linux-procfs/
categories: [技术, Linux内核]
tags: [procfs, 可观测性, 内核]
---

procfs 是虚拟文件系统，文件内容在读取时由内核动态生成。它把进程、内存、CPU、网络和内核参数投影成一组文件，因此排障时可以用普通文件工具观察系统。但它不是一个稳定的数据库快照：你读到第一行和最后一行之间，系统状态仍可能已经变化。

<div class="note-flow"><span>用户读取 /proc 文件</span><i>→</i><span>VFS 路由到 procfs</span><i>→</i><span>内核回调收集状态</span><i>→</i><span>格式化为文本返回</span></div>

<figure class="note-visual"><figcaption><span>观测图</span>不同 `/proc` 文件回答的是不同层次的问题，读之前先确定想验证什么。</figcaption><div class="note-map"><span><b>/proc/PID/status</b><small>查看线程数、状态、能力和内存概况。</small></span><span><b>/proc/PID/maps</b><small>观察虚拟地址区域、文件映射和匿名内存。</small></span><span><b>/proc/PID/smaps</b><small>补充每段的 RSS、PSS、共享和脏页信息。</small></span><span><b>/proc/meminfo</b><small>从系统视角看内存总量、缓存、回收和可用量。</small></span><span><b>/proc/interrupts</b><small>比较各 CPU 和设备的中断分布，发现异常热点。</small></span><span><b>/proc/sys</b><small>部分文件可写，修改前要确认范围和恢复方式。</small></span></div></figure>

## 读数要和采样时间一起保存

排查内存增长时，只读一次 `status` 很难区分泄漏、缓存增长和短时峰值。应按固定间隔保存同一组字段，并同时记录进程重启、负载变化和系统总量。读取 `maps`、`smaps` 这类大文件时还要注意进程可能正在创建或释放映射，工具要能容忍内容在读取期间改变。

对于高频采样，反复解析很大的文本文件本身也会带来开销。先用粗粒度指标锁定时间窗口，再深入读取具体 PID 或 subsystem 的细节，比把所有 `/proc` 文件无差别轮询更稳妥。

## 可写节点要像配置变更一样对待

`/proc/sys` 下的部分接口会直接改变内核参数。脚本在写入前应保存旧值、说明影响范围，并提供恢复路径。把调优命令和观测命令混在同一段脚本里，很容易让一次排查变成不可解释的系统状态变化。

参考：[proc 虚拟文件系统](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247485423&idx=1&sn=e1b8af580820dee654e7c89b74732223)
