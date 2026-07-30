---
title: MCU Shell：给嵌入式设备一个可诊断入口
date: 2026-06-13 14:00:00
permalink: /2026/07/29/mcu-shell/
categories: [技术, 嵌入式]
tags: [Shell, letter-shell, 调试]
---

MCU Shell 通过串口、USB CDC 或网络提供命令注册、参数解析和输出。它的价值不是“像 Linux 一样有个终端”，而是在不重新烧录固件时查看状态、导出诊断、修改临时参数和执行受控自检。好的 Shell 会让现场定位更快；没有边界的 Shell 则可能变成量产设备的后门。

<div class="note-flow"><span>接收命令行</span><i>→</i><span>分词与参数校验</span><i>→</i><span>查找命令表</span><i>→</i><span>执行受控诊断</span><i>→</i><span>格式化返回结果</span></div>

<figure class="note-visual"><figcaption><span>命令图</span>输入解析、权限、业务执行和输出通道应彼此独立。</figcaption><div class="note-map"><span><b>输入缓冲</b><small>限制一行长度和字符集，处理退格、超时和断线。</small></span><span><b>命令表</b><small>命令名、参数格式、权限和帮助信息集中定义。</small></span><span><b>参数校验</b><small>先检查数值范围和状态，再调用底层接口。</small></span><span><b>诊断命令</b><small>读取版本、计数器和传感器，默认不改变持久状态。</small></span><span><b>危险命令</b><small>擦除、校准和驱动输出需要额外授权或物理条件。</small></span><span><b>输出限速</b><small>大输出和连续监视不能堵塞关键任务。</small></span></div></figure>

## 命令要有清楚的权限和副作用

读取版本、查看传感器、导出日志可以作为低风险命令；改写 Flash、切换电机输出、关闭安全检查属于高风险操作。高风险命令应要求维护模式、物理按键、签名令牌或至少明确的会话权限，并在操作后给出可审计记录。不要用一个隐藏字符串当作长期安全机制。

## Shell 不能抢占系统本职工作

命令处理应在普通任务中执行，输入和输出都有长度与速率限制。长时间操作可拆成启动、查询进度和取消三类命令，不要让一条串口命令阻塞控制循环。现场复现问题时，优先提供只读快照命令，而不是要求操作者输入一串会改变系统状态的调试开关。

参考：[letter-shell](https://github.com/NevermindZZT/letter-shell)
