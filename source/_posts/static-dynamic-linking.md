---
title: 静态链接与动态链接：符号如何成为可执行程序
date: 2026-07-07 20:20:00
permalink: /2026/07/29/static-dynamic-linking/
categories: [技术, C-C++]
tags: [链接器, ELF, 动态库]
---

链接器解析目标文件符号和重定位，把代码与数据组织为 ELF。静态链接把所需库代码复制进程序；动态链接保留依赖，由动态加载器在启动或首次调用时解析。

<div class="note-flow"><span>编译生成 .o</span><i>→</i><span>收集符号与节</span><i>→</i><span>解析引用并重定位</span><i>→</i><span>生成 ELF</span><i>→</i><span>动态加载器处理共享库</span></div>

GOT/PLT 支持位置无关代码与延迟绑定。排查问题可用 `readelf`、`nm`、`objdump`、`ldd` 和 `LD_DEBUG`。

参考：[动态链接与静态链接](https://www.kerneltravel.net/blog/2020/dynamic_static_linking_szp/)
