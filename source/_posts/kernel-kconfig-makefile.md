---
title: Kconfig、Makefile 与 .config：驱动代码如何进入内核
date: 2026-07-29 14:13:00
categories: [技术, Linux内核]
tags: [Kconfig, Makefile, 内核构建]
---

Kconfig 定义配置选项与依赖，配置工具生成 `.config`，Kbuild Makefile 再依据 `CONFIG_*` 决定对象编入内核、构建为模块或完全跳过。

<div class="note-flow"><span>编写 Kconfig 选项</span><i>→</i><span>menuconfig 解析依赖</span><i>→</i><span>生成 .config/autoconf</span><i>→</i><span>Kbuild 选择 obj-y/obj-m</span><i>→</i><span>链接内核或生成 .ko</span></div>

`bool` 只能内建或关闭，`tristate` 还可为模块。新增目录时必须从父级 Kconfig 和 Makefile 接入，避免“选项可见但代码未编译”。

参考：[Makefile、Kconfig 与 .config](https://www.kerneltravel.net/blog/2020/makefile_3/)
