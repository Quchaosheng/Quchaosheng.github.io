---
title: CMake 的 PUBLIC、PRIVATE 与 INTERFACE：链接关系写错了会怎样
date: 2026-09-17 09:30:00
permalink: /2026/09/17/cmake-target-link-libraries-scope/
categories: [技术, 工具链]
tags: [CMake, 链接, 依赖传播, 构建系统]
---

一个库在本地构建正常，被另一个包引用后出现找不到头文件或未定义符号。排查时发现库本身没问题，问题出在它对外声明依赖关系的方式上。CMake 用 `PUBLIC`、`PRIVATE` 和 `INTERFACE` 三个关键字描述依赖传播范围，写错会出现“自己能用、别人不能用”的现象。

这篇文章讨论这三个关键字各自的含义，以及怎么用一条命令验证依赖是否正确传播。

<div class="note-flow"><span>库内部使用依赖</span><i>→</i><span>声明传播范围</span><i>→</i><span>生成使用要求</span><i>→</i><span>下游按需继承</span><i>→</i><span>导出并被 find_package 发现</span><i>→</i><span>验证下游可独立构建</span></div>

<figure class="note-visual"><figcaption><span>三种范围</span>区别在于依赖是否进入目标对外的使用要求里。</figcaption><div class="note-map"><span><b>PRIVATE</b><small>只在当前目标内使用，不传播给下游。</small></span><span><b>PUBLIC</b><small>当前目标使用，同时写入对外的使用要求。</small></span><span><b>INTERFACE</b><small>当前目标不使用，但下游必须使用，常见于头文件库。</small></span><span><b>头文件目录</b><small>头文件里出现的依赖通常需要传播。</small></span><span><b>编译定义</b><small>进入头文件的宏也必须传播。</small></span><span><b>导出</b><small>安装后的目标需要能被下游重新解析依赖。</small></span></div></figure>

## 判断标准是依赖有没有出现在头文件里

最简单的判断方式：如果下游编译时需要在头文件里 include 这个依赖，那么它必须传播；如果只在本目标的实现文件里用到，就可以不传播。

```cmake
add_library(robot_task src/task.cpp)

# 头文件 robot/task.hpp 里 include 了这个库的头，下游也要能找到
target_link_libraries(robot_task PUBLIC some_interface_lib)

# 只在 task.cpp 里用到，外部不需要知道
target_link_libraries(robot_task PRIVATE some_internal_lib)

# 头文件里出现的编译定义同样需要传播
target_compile_definitions(robot_task PUBLIC ROBOT_TASK_API_VERSION=2)
```

把应该在头文件里暴露的依赖写成 `PRIVATE`，是本机编译通过、下游报“找不到头文件”的最常见原因。反过来，把纯内部依赖写成 `PUBLIC`，会把实现细节泄漏给所有下游，增加耦合，也可能引入不必要的构建依赖。

## 头文件库用 INTERFACE

只有头文件的库自己不需要编译，但它给下游的要求是真实的：

```cmake
add_library(robot_headers INTERFACE)
target_include_directories(robot_headers INTERFACE
  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
  $<INSTALL_INTERFACE:include>)
target_link_libraries(robot_headers INTERFACE some_dependency)
```

`BUILD_INTERFACE` 和 `INSTALL_INTERFACE` 的区别在于构建阶段与安装后使用不同的路径。只写绝对路径会在安装后失效，这是另一个常见的“本地正常、安装后失败”来源。

## 依赖必须能被下游解析

只在自己的 CMakeLists 里写 `target_link_libraries` 还不够。安装并导出后，下游通过 `find_package` 找到这个目标时，需要重新解析它的依赖。如果依赖没有一起被导出，配置阶段会报找不到目标。

```cmake
install(TARGETS robot_task EXPORT robot_task_targets ...)
install(EXPORT robot_task_targets
  NAMESPACE robot:: DESTINATION lib/cmake/robot_task)
```

用 `PUBLIC` 或 `INTERFACE` 声明的依赖会进入导出信息，前提是这些依赖本身也能被下游找到。这就是为什么链接关系写错时，错误往往出现在下游的配置阶段，而不是本包的构建阶段。

## 验证要站在下游做

验证依赖传播最有效的方式是让另一个包真正用一次：

```bash
# 在本包目录内构建成功，不能说明依赖传播正确
cmake -S . -B build && cmake --build build

# 关键验证：用一个独立的最小工程 find_package 后编译
cmake -S tests/consumer -B /tmp/consumer-build
cmake --build /tmp/consumer-build
```

一个独立的最小消费工程能暴露三类问题：头文件目录没有传播、需要的依赖没有被导出、以及编译定义在安装后丢失。在自己的工程里编译，这些都不会暴露，因为源码目录仍然可见。

## 和交叉编译的关系

交叉编译场景下，这些范围问题会更加明显，因为下游找不到宿主机上的同名库。依赖传播范围的错误在交叉编译时往往从“偶尔失败”变成“必然失败”。

因此交叉编译的验证流程应当包含一个消费工程，而不是只把主库构建通过当作完成。这与交叉编译工具链文件的正确性是两件独立的事，需要分别验证。

## 参考资料

- [target_link_libraries 命令文档](https://cmake.org/cmake/help/latest/command/target_link_libraries.html)
- [CMake 构建系统与使用要求](https://cmake.org/cmake/help/latest/manual/cmake-buildsystem.7.html)
- [CMake 包导出与 find_package](https://cmake.org/cmake/help/latest/command/install.html)

## 证据边界

本文讨论 CMake 依赖传播范围的语义与验证方式，不包含任何具体项目的构建配置。文中判断标准适用于常规 C++ 库；涉及生成代码、自定义命令或运行时插件的场景，依赖关系需要另行分析，不能直接套用。
