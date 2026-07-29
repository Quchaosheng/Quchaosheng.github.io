---
title: MCU Shell：给嵌入式设备一个可诊断入口
date: 2026-07-29 14:21:00
categories: [技术, 嵌入式]
tags: [Shell, letter-shell, 调试]
---

MCU Shell 通过串口或网络提供命令注册、参数解析和输出，可在不重新烧录固件的情况下检查状态、修改临时参数和执行自检。

<div class="note-flow"><span>接收命令行</span><i>→</i><span>分词与参数校验</span><i>→</i><span>查找命令表</span><i>→</i><span>执行受控诊断</span><i>→</i><span>格式化返回结果</span></div>

量产设备必须设置权限与超时，危险命令不可默认开放。参考：[letter-shell](https://github.com/NevermindZZT/letter-shell)
