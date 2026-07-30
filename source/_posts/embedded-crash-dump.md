---
title: 嵌入式崩溃转储：复位后仍能还原现场
date: 2026-07-19 20:20:00
permalink: /2026/07/29/embedded-crash-dump/
categories: [技术, 嵌入式]
tags: [CrashDump, 故障诊断, Flash]
---

异常发生时应在最短路径保存复位原因、寄存器、栈片段、任务信息和固件版本到保留 RAM 或预擦除 Flash，下一次启动再上传解析。

<div class="note-flow"><span>异常/看门狗触发</span><i>→</i><span>冻结最小现场</span><i>→</i><span>写入带 CRC 的转储槽</span><i>→</i><span>系统复位</span><i>→</i><span>启动后读取、上传并符号化</span></div>

异常路径不可依赖锁、堆和复杂驱动。参考：[CmBacktrace](https://github.com/armink/CmBacktrace)
