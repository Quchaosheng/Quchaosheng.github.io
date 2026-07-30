---
title: CMake 交叉编译：工具链文件决定目标环境
date: 2026-07-02 14:00:00
permalink: /2026/07/29/cmake-cross-compilation/
categories: [技术, 工具链]
tags: [CMake, 交叉编译, Toolchain]
---

交叉编译不只是把 `gcc` 换成 `aarch64-linux-gnu-gcc`。配置、头文件查找、库查找、try-compile 和安装路径都要按目标机来处理。CMake 的 toolchain file 会告诉它目标系统、架构、编译器、sysroot 和查找规则。文件写得不完整时，最麻烦的是它可能悄悄链接到宿主机库。

<div class="note-flow"><span>读取 toolchain.cmake</span><i>→</i><span>识别目标编译器与 sysroot</span><i>→</i><span>查找目标头文件和库</span><i>→</i><span>生成构建系统</span><i>→</i><span>编译并部署到目标板</span></div>

## Toolchain file 必须回答哪些问题

目标系统是什么、CPU/ABI 是什么、C/C++ 编译器在哪里、sysroot 在哪里，以及 CMake 查找外部程序和目标库时各该去哪。宿主机上运行的工具（代码生成器、pkg-config wrapper）与目标机上的库是不同概念，不能混在同一个搜索路径里。

<figure class="note-visual"><figcaption><span>构建图</span>toolchain file 的任务是让 CMake 始终以目标系统的视角寻找编译器、头文件和库。</figcaption><div class="note-map"><span><b>CMAKE_SYSTEM_NAME</b><small>声明目标系统，例如 Linux，触发交叉编译模式</small></span><span><b>CMAKE_SYSTEM_PROCESSOR</b><small>目标架构/处理器信息，供项目选择架构相关代码</small></span><span><b>编译器</b><small>CMAKE_C_COMPILER/CXX_COMPILER 指向目标工具链</small></span><span><b>sysroot</b><small>目标头文件、库和动态链接器所属的根目录</small></span><span><b>find root path</b><small>限制 find_library/find_path 不误用宿主机依赖</small></span><span><b>try-compile</b><small>交叉构建时配置测试程序不能直接在宿主机执行</small></span></div></figure>

一个最小工具链文件可以从下面开始，再按 SDK/Buildroot 输出调整路径：

```cmake
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR aarch64)
set(CMAKE_C_COMPILER aarch64-linux-gnu-gcc)
set(CMAKE_CXX_COMPILER aarch64-linux-gnu-g++)
set(CMAKE_SYSROOT /opt/sdk/sysroot)
set(CMAKE_FIND_ROOT_PATH ${CMAKE_SYSROOT})
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
set(CMAKE_TRY_COMPILE_TARGET_TYPE STATIC_LIBRARY)
```

最后一行可避免一些 `try_compile` 测试在配置阶段尝试运行目标程序。它不是万能设置，使用 `try_run()` 的项目仍需要提供预置结果或交叉编译替代方案。

## 最常见的三个错误

第一，`find_package()` 找到了 `/usr/lib` 的宿主机库，产物在目标板上无法运行或 ABI 不匹配。第二，pkg-config 没有设置 sysroot/库目录，给出了宿主机 `.pc` 文件的路径。第三，项目把绝对 SDK 路径写进 `CMakeLists.txt`，导致其他开发机或 CI 无法复现。

应把工具链路径、sysroot、第三方依赖和部署目录放进 toolchain file、CMake cache 或预设，而不是散落在源码里。构建后用 `file`、`readelf -d` 和目标机运行测试确认 ELF 架构、动态链接器和依赖库都正确。

```bash
file my_app
readelf -d my_app | grep NEEDED
```

## 交叉编译的交付边界

二进制能编过，还要检查目标 rootfs 有没有对应的 C 库和动态链接器，插件、配置、数据文件是否到了正确路径，升级 SDK 后 ABI 有没有变。把这些检查放进 CMake install、打包和 CI，交付时会少很多手工步骤。

参考：[CMake Cross Compiling](https://cmake.org/cmake/help/latest/manual/cmake-toolchains.7.html) · [CMAKE_SYSROOT](https://cmake.org/cmake/help/latest/variable/CMAKE_SYSROOT.html)
