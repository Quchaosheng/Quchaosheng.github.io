---
title: 静态链接与动态链接：符号如何成为可执行程序
date: 2026-04-08 14:00:00
permalink: /2026/07/29/static-dynamic-linking/
categories: [技术, C-C++]
tags: [链接器, ELF, 动态库]
---

链接器解析目标文件符号和重定位，把代码与数据组织为 ELF。静态链接把所需库代码复制进程序；动态链接保留依赖，由动态加载器在启动或首次调用时解析。看似都是“把库连进去”，实际差别会体现在部署体积、升级方式、启动行为、地址无关代码和运行时排错上。

<div class="note-flow"><span>编译生成 .o</span><i>→</i><span>收集符号与节</span><i>→</i><span>解析引用并重定位</span><i>→</i><span>生成 ELF</span><i>→</i><span>动态加载器处理共享库</span></div>

<figure class="note-visual"><figcaption><span>链接图</span>静态链接在构建期解决大部分引用，动态链接把一部分工作留到运行时。</figcaption><div class="note-map"><span><b>.o 与节</b><small>编译器产出代码、数据、重定位和符号信息。</small></span><span><b>符号解析</b><small>链接器匹配定义与引用，决定哪个实现满足调用。</small></span><span><b>重定位</b><small>把代码和数据中的地址引用调整到最终布局。</small></span><span><b>静态库</b><small>所需对象被复制到最终 ELF，部署更独立但体积可能变大。</small></span><span><b>共享库</b><small>ELF 记录依赖，动态加载器在运行时找到并映射库文件。</small></span><span><b>GOT/PLT</b><small>帮助位置无关代码间接访问外部符号，并支持延迟绑定。</small></span></div></figure>

## 符号、对象和文件描述的是不同层次

一个 ELF 可以定义或引用许多符号；静态库是对象文件的归档；共享库是可在运行时映射的 ELF。链接失败时先分清是“没有找到定义”“定义被隐藏”“库顺序不对”还是“架构、ABI 不匹配”。运行失败时再检查动态加载器到底搜索了哪些路径、加载了哪一版库。

## 工具输出要从结构到行为逐步看

`readelf -d` 可以查看动态依赖，`nm` 用于检查符号是否定义或未定义，`objdump` 有助于看反汇编和重定位，`ldd` 能快速显示运行时解析到的共享库。需要更深排查时，`LD_DEBUG` 能显示动态加载过程，但输出会很多，应在隔离环境中使用并避免把它当作生产日志。

静态链接并不自动消除所有运行时依赖，例如名称解析、配置、插件和内核 ABI 仍可能影响程序；动态链接也不必然慢，重点是依赖图是否可控、版本是否可追踪。

参考：[动态链接与静态链接](https://www.kerneltravel.net/blog/2020/dynamic_static_linking_szp/)
