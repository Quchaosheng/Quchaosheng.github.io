---
title: kGDB：远程单步调试 Linux 内核
date: 2026-04-01 14:00:00
permalink: /2026/07/29/linux-kgdb/
categories: [技术, 调试]
tags: [kGDB, GDB, 内核调试]
---

kGDB 在目标内核中实现 GDB 远程调试协议，可通过串口或其他 kgdboc 通道暂停内核、设置断点、查看变量和单步执行。它适合早期启动、驱动 probe、锁死和异常路径的交互式定位，但暂停内核会改变时序，因此不能把调试过程当成正常运行环境。

<div class="note-flow"><span>目标内核启用 KGDB</span><i>→</i><span>kgdboc 配置传输通道</span><i>→</i><span>触发断点进入调试器</span><i>→</i><span>主机 GDB 连接 vmlinux</span><i>→</i><span>断点、单步与检查状态</span></div>

<figure class="note-visual"><figcaption><span>调试图</span>主机符号、目标内核、传输通道和多核停机行为必须同时匹配。</figcaption><div class="note-map"><span><b>vmlinux</b><small>必须与目标运行的内核完全对应，并保留调试符号。</small></span><span><b>kgdboc</b><small>指定调试 I/O 通道，通道本身不能被普通控制台争抢。</small></span><span><b>断点入口</b><small>可由显式断点、异常或 SysRq 等机制进入调试器。</small></span><span><b>CPU 停止</b><small>其他 CPU 的停机和中断状态会改变并发问题的现场。</small></span><span><b>看门狗</b><small>单步过久可能触发 watchdog，需要提前规划调试窗口。</small></span><span><b>恢复执行</b><small>继续运行前确认断点、单步和临时状态不会留下副作用。</small></span></div></figure>

## 第一步永远是核对符号文件

主机加载的 `vmlinux`、目标运行的镜像、模块和配置必须来自同一次构建。若符号偏移不匹配，GDB 仍可能显示函数名，但局部变量、调用栈和断点位置都不可信。使用可加载模块时，也要在模块完成加载后让 GDB 知道其符号位置。

## 把时序影响当成调试条件的一部分

暂停一个 CPU、单步执行锁相关代码或让串口占用控制台，都会改变竞争关系。多核下其他 CPU 通常会被协调停住，这有利于检查一致快照，却可能让 race condition 暂时消失。先用 tracing 记录真实运行的时间线，再用 kGDB 针对一个明确地址深入，通常比一开始就单步整条路径更有效。

参考：[用 kGDB 调试 Linux 内核](https://tinylab.org/kgdb-debugging-kernel/)
