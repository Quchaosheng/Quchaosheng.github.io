---
title: Linux 内核启动：从固件到第一个用户进程
date: 2026-07-29 13:37:00
categories: [技术, Linux内核]
tags: [内核启动, Bootloader, init]
---

启动链路的职责逐层递交：固件完成最小硬件初始化，Bootloader 装载内核、initramfs 和设备树，内核建立内存与调度子系统，最后启动 PID 1。

<div class="note-flow"><span>固件/ROM</span><i>→</i><span>Bootloader</span><i>→</i><span>解压并进入内核</span><i>→</i><span>初始化内存与驱动</span><i>→</i><span>挂载根文件系统并启动 init</span></div>

排障时区分“串口无输出、内核解压失败、根文件系统挂载失败、init 不存在”四类阶段，日志位置和修复方向完全不同。

参考：[Linux 内核启动过程](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247485098&idx=1&sn=48ca06327603aff99a6538063559aa97)
