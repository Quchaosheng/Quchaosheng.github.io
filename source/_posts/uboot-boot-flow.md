---
title: U-Boot 启动流程：从上电到跳入 Linux
date: 2026-07-29 14:33:00
categories: [技术, 嵌入式Linux]
tags: [U-Boot, 启动, 设备树]
---

U-Boot SPL 在片上 RAM 完成 DRAM 等最小初始化并加载完整 U-Boot；主程序初始化设备、读取环境变量，加载内核、DTB 与 initramfs 后执行 boot 命令。

<div class="note-flow"><span>ROM 加载 SPL</span><i>→</i><span>SPL 初始化 DRAM</span><i>→</i><span>加载 U-Boot proper</span><i>→</i><span>装载 Kernel/DTB</span><i>→</i><span>设置参数并跳转内核</span></div>

排障要确认加载地址不重叠、设备树匹配、bootargs 正确和存储驱动可用。参考：[U-Boot](https://source.denx.de/u-boot/u-boot)
