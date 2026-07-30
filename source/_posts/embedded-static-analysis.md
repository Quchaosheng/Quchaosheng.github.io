---
title: 嵌入式静态分析：在运行前发现危险路径
date: 2026-07-03 14:00:00
permalink: /2026/07/29/embedded-static-analysis/
categories: [技术, 工具链]
tags: [Cppcheck, 静态分析, MISRA]
---

静态分析沿控制流和数据流查找空指针、越界、未初始化值、资源泄漏与可疑并发，不需要执行目标程序，适合难以完整测试的固件。它不会证明程序“没有 bug”，但能在代码进入板子前持续发现一批人眼容易漏掉的路径。

<div class="note-flow"><span>生成 compile_commands.json</span><i>→</i><span>运行编译器告警与分析器</span><i>→</i><span>按严重度归类</span><i>→</i><span>修复或记录理由</span><i>→</i><span>CI 阻止新增缺陷</span></div>

<figure class="note-visual"><figcaption><span>检查图</span>编译器、分析器和人工审查各自覆盖不同类型的问题。</figcaption><div class="note-map"><span><b>编译告警</b><small>最快发现类型、格式、未使用和明显控制流问题。</small></span><span><b>编译数据库</b><small>让工具看到真实 include、宏和目标架构参数。</small></span><span><b>数据流分析</b><small>追踪空指针、未初始化值、资源和边界跨函数传播。</small></span><span><b>规则集</b><small>MISRA 等规则需要结合项目风险和例外处理，不应盲目全开。</small></span><span><b>基线</b><small>先记录遗留告警，防止新改动继续扩大问题规模。</small></span><span><b>复核理由</b><small>误报、偏离规则和无法修复项都要留下可审计说明。</small></span></div></figure>

## 让工具分析真实构建，而不是猜测源码

`compile_commands.json` 或等价构建信息会告诉分析器使用哪个编译器、头文件、宏、语言标准和目标架构。没有这些信息，工具可能在错误的条件编译分支里分析，结果要么噪声极多，要么漏掉目标板专用代码。交叉编译项目尤其需要把 sysroot 和编译参数传完整。

## 规则要逐步收紧，CI 要阻止倒退

先把高置信度缺陷和编译器告警清掉，再按模块启用更严格的规则。一次性导入成千上万条遗留告警，只会让团队把所有警告静音。更实际的策略是建立基线，要求新代码不引入新的高严重度问题；对每个抑制项写明原因、责任人和复查条件。

静态分析不能替代单元测试、硬件测试和代码审查，但它能让这些更昂贵的环节少花时间在明显错误上。

参考：[Cppcheck](https://github.com/danmar/cppcheck)
