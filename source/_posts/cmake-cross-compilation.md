---
title: CMake 交叉编译：工具链文件决定目标环境
date: 2026-07-29 14:42:00
categories: [技术, 工具链]
tags: [CMake, 交叉编译, Toolchain]
---

交叉编译工具链文件声明目标系统、编译器、sysroot 和查找策略，使 CMake 在主机执行配置、为目标生成二进制。

<div class="note-flow"><span>读取 toolchain.cmake</span><i>→</i><span>识别目标编译器与 sysroot</span><i>→</i><span>查找目标头文件和库</span><i>→</i><span>生成构建系统</span><i>→</i><span>编译并部署到目标板</span></div>

避免把绝对路径写进项目，编译器检查程序不能在主机直接运行时需调整 try-compile。参考：[CMake](https://cmake.org/)
