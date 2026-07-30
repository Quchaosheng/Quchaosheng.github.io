---
title: 嵌入式静态分析：在运行前发现危险路径
date: 2026-07-03 14:00:00
permalink: /2026/07/29/embedded-static-analysis/
categories: [技术, 工具链]
tags: [Cppcheck, 静态分析, MISRA]
---

静态分析沿控制流和数据流查找空指针、越界、未初始化值、资源泄漏与可疑并发，不需要执行目标程序，适合难以完整测试的固件。

<div class="note-flow"><span>生成 compile_commands.json</span><i>→</i><span>运行编译器告警与分析器</span><i>→</i><span>按严重度归类</span><i>→</i><span>修复或记录理由</span><i>→</i><span>CI 阻止新增缺陷</span></div>

先开启高质量编译告警，再引入 Cppcheck/Clang-Tidy；规则集应逐步收紧。参考：[Cppcheck](https://github.com/danmar/cppcheck)
