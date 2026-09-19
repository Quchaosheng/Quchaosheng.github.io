---
title: CMake 的 PUBLIC、PRIVATE 与 INTERFACE：链接关系写错了会怎样
date: 2026-09-17 09:30:00
permalink: /2026/09/17/cmake-target-link-libraries-scope/
categories: [技术， 工具链]
tags: [CMake， 链接， 依赖传播， 构建系统]
---

自己包里编译通过，被别人引用就报找不到头文件——这种情况我遇到过好几次，每次第一反应都是怀疑对方环境有问题，最后发现是 `PRIVATE` 和 `PUBLIC` 写反了。

CMake 用这三个关键字描述依赖传播范围。写错的结果就是“自己能用、别人不能用”。

<div class="note-flow"><span>库内部使用依赖</span><i>→</i><span>声明传播范围</span><i>→</i><span>生成使用要求</span><i>→</i><span>下游按需继承</span><i>→</i><span>导出并被 find_package 发现</span><i>→</i><span>验下游能独立构建</span></div>

<figure class="note-visual"><figcaption><span>三种范围</span>区别就在于依赖要不要进到目标对外的使用要求里。</figcaption><div class="note-map"><span><b>PRIVATE</b><small>只在当前目标内用，不传给下游。</small></span><span><b>PUBLIC</b><small>自己用，同时写进对外的使用要求。</small></span><span><b>INTERFACE</b><small>自己不用但下游必须用，常见于头文件库。</small></span><span><b>头文件目录</b><small>头文件里出现的依赖通常要传播。</small></span><span><b>编译定义</b><small>进头文件的宏也必须传播。</small></span><span><b>导出</b><small>安装后的目标要能被下游重新解析依赖。</small></span></div></figure>

## 判断标准是依赖有没有进头文件

最简单的判断:下游编译时需不需要在头文件里 include 这个依赖。需要就传播，只在实现文件里用到就可以不传播。

```cmake
add_library(robot_task src/task.cpp)

# robot/task.hpp 里 include 了它的头,下游也要能找到
target_link_libraries(robot_task PUBLIC some_interface_lib)

# 只在 task.cpp 里用,外部不需要知道
target_link_libraries(robot_task PRIVATE some_internal_lib)

# 头文件里出现的编译定义同样要传播
target_compile_definitions(robot_task PUBLIC ROBOT_TASK_API_VERSION=2)
```

该暴露的依赖写成 `PRIVATE`，就是本机通过、下游报“找不到头文件”的最常见原因。反过来，纯内部依赖写成 `PUBLIC` 会把实现细节漏给所有下游，增加耦合，还可能引入不必要的构建依赖。

## 头文件库用 INTERFACE

只有头文件的库自己不用编译，但它给下游的要求是实打实的:

```cmake
add_library(robot_headers INTERFACE)
target_include_directories(robot_headers INTERFACE
  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
  $<INSTALL_INTERFACE:include>)
target_link_libraries(robot_headers INTERFACE some_dependency)
```

`BUILD_INTERFACE` 和 `INSTALL_INTERFACE` 的区别在于构建阶段和安装后用不同的路径。只写绝对路径安装后就失效了，这是另一个“本地正常、装完就坏”的来源。

## 依赖得能被下游解析

只在自己的 CMakeLists 里写 `target_link_libraries` 还不够。安装并导出之后，下游通过 `find_package` 找到这个目标时要重新解析它的依赖，依赖没一起导出，配置阶段就会报找不到目标。

```cmake
install(TARGETS robot_task EXPORT robot_task_targets ...)
install(EXPORT robot_task_targets
  NAMESPACE robot:: DESTINATION lib/cmake/robot_task)
```

用 `PUBLIC` 或 `INTERFACE` 声明的依赖会进导出信息，前提是它们本身也能被下游找到。这也是为什么链接关系写错时，错误常常出现在下游的配置阶段，而不是本包的构建阶段。

## 验证要站在下游做

验证依赖传播最有效的办法是让另一个包真的用一次:

```bash
# 在本包目录里构建成功,说明不了传播是对的
cmake -S . -B build && cmake --build build

# 关键:用一个独立的最小工程 find_package 后编译
cmake -S tests/consumer -B /tmp/consumer-build
cmake --build /tmp/consumer-build
```

一个独立的最小消费工程能暴露三类问题:头文件目录没传播、需要的依赖没被导出、编译定义安装后丢了。在自己工程里编译这些都不会暴露，因为源码目录一直可见。

## 交叉编译下更明显

交叉编译场景里这些问题会更突出，因为下游找不到宿主机上的同名库。依赖传播范围写错，在交叉编译时往往从“偶尔失败”变成“必然失败”。

所以交叉编译的验证流程应该包含一个消费工程，而不是主库构建通过就算完。这跟工具链文件对不对是两件独立的事，得分别验。

## 参考资料

- [target_link_libraries 命令文档](https://cmake.org/cmake/help/latest/command/target_link_libraries.html)
- [CMake 构建系统与使用要求](https://cmake.org/cmake/help/latest/manual/cmake-buildsystem.7.html)
- [CMake 包导出与 install](https://cmake.org/cmake/help/latest/command/install.html)

**证据边界：**本文不含任何具体项目的构建配置。上面的判断标准适用于常规 C++ 库;涉及生成代码、自定义命令或者运行时插件的场景，依赖关系要另行分析，不能直接套。
