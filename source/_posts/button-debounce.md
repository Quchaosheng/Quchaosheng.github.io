---
title: 按键消抖：从电气抖动到可靠事件
date: 2026-07-19 09:30:00
permalink: /2026/07/29/button-debounce/
categories: [技术, 嵌入式]
tags: [按键, 消抖, 事件]
---

机械触点在按下和释放时会快速跳变。软件通常周期采样，只有输入连续稳定达到阈值才改变逻辑状态，并进一步识别单击、长按与连击。

<div class="note-flow"><span>周期采样 GPIO</span><i>→</i><span>更新稳定计数</span><i>→</i><span>超过阈值确认状态</span><i>→</i><span>计算按压时长</span><i>→</i><span>发布按键事件</span></div>

中断可用于唤醒，但不应直接把每次边沿当成一次按键。参考：[MultiButton](https://github.com/0x1abin/MultiButton)
