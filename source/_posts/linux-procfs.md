---
title: procfs：把内核运行状态投影成文件
date: 2026-07-29 13:41:00
categories: [技术, Linux内核]
tags: [procfs, 可观测性, 内核]
---

procfs 是虚拟文件系统，文件内容在读取时由内核动态生成。它暴露进程、内存、CPU、网络与内核参数状态，是排障和观测的重要入口。

<div class="note-flow"><span>用户读取 /proc 文件</span><i>→</i><span>VFS 路由到 procfs</span><i>→</i><span>内核回调收集状态</span><i>→</i><span>格式化为文本返回</span></div>

`/proc/PID/status`、`maps`、`smaps` 用于进程诊断；`/proc/meminfo`、`stat`、`interrupts` 用于系统观察。procfs 是瞬时视图，采集工具应处理读取期间状态变化。

参考：[proc 虚拟文件系统](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247485423&idx=1&sn=e1b8af580820dee654e7c89b74732223)
