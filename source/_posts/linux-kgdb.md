---
title: kGDB：远程单步调试 Linux 内核
date: 2026-05-25 14:00:00
permalink: /2026/07/29/linux-kgdb/
categories: [技术, 调试]
tags: [kGDB, GDB, 内核调试]
---

kGDB 在目标内核中实现 GDB 远程调试协议，可通过串口或其他 kgdboc 通道暂停内核、设置断点、查看变量和单步执行。

<div class="note-flow"><span>目标内核启用 KGDB</span><i>→</i><span>kgdboc 配置传输通道</span><i>→</i><span>触发断点进入调试器</span><i>→</i><span>主机 GDB 连接 vmlinux</span><i>→</i><span>断点、单步与检查状态</span></div>

主机必须加载与目标完全匹配、包含调试符号的 `vmlinux`。单步内核可能影响时序和看门狗，多核下其他 CPU 通常也会被暂停；生产设备使用前必须评估安全与可用性风险。

参考：[用 kGDB 调试 Linux 内核](https://tinylab.org/kgdb-debugging-kernel/)
