---
title: LVGL 渲染流程：脏区、绘制缓冲与显示刷新
date: 2026-07-29 14:35:00
categories: [技术, 嵌入式GUI]
tags: [LVGL, GUI, 显示]
---

LVGL 根据对象变化标记无效区域，布局与绘制阶段只重绘脏区到缓冲区，再调用显示驱动 flush。单缓冲省内存，双缓冲可与 DMA 并行刷新。

<div class="note-flow"><span>输入或动画改变对象</span><i>→</i><span>标记 invalid area</span><i>→</i><span>布局与绘制到 buffer</span><i>→</i><span>flush_cb 交给 LCD/DMA</span><i>→</i><span>通知刷新完成</span></div>

性能优化关注缓冲大小、色深、合并脏区、图片格式和 DMA/cache 一致性。参考：[LVGL](https://github.com/lvgl/lvgl)
