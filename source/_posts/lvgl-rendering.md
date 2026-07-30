---
title: LVGL 渲染流程：脏区、绘制缓冲与显示刷新
date: 2026-06-26 10:00:00
permalink: /2026/07/29/lvgl-rendering/
categories: [技术, 嵌入式GUI]
tags: [LVGL, GUI, 显示]
---

LVGL 根据对象变化标记无效区域，布局与绘制阶段只重绘脏区到缓冲区，再调用显示驱动的 `flush_cb` 把像素交给 LCD 或 DMA。它的性能不只由 CPU 决定：色深、脏区合并、绘制缓冲大小、总线带宽和 DMA/cache 一致性会共同决定一帧什么时候真正显示出来。

<div class="note-flow"><span>输入或动画改变对象</span><i>→</i><span>标记 invalid area</span><i>→</i><span>布局与绘制到 buffer</span><i>→</i><span>flush_cb 交给 LCD/DMA</span><i>→</i><span>通知刷新完成</span></div>

<figure class="note-visual"><figcaption><span>渲染图</span>LVGL 负责生成像素，显示驱动负责把像素安全地送到面板。</figcaption><div class="note-map"><span><b>invalid area</b><small>对象变化后标记脏区，避免每次重绘整屏。</small></span><span><b>区域合并</b><small>相邻脏区可合并，过度合并又可能让无效像素变多。</small></span><span><b>draw buffer</b><small>全屏、部分缓冲和双缓冲在 RAM、吞吐和延迟上取舍不同。</small></span><span><b>颜色格式</b><small>RGB565、ARGB 等影响每像素字节数、转换成本和带宽。</small></span><span><b>flush_cb</b><small>驱动启动 SPI、并口或 DMA 传输，并在完成后通知 LVGL。</small></span><span><b>cache/DMA</b><small>有 D-cache 的 MCU 必须确保 DMA 看到的是最新像素数据。</small></span></div></figure>

## 缓冲区大小先由面板带宽决定

全屏双缓冲可以让绘制和传输并行，但会占用两帧 RAM；部分缓冲省内存，却可能因多次 `flush` 增加总线开销。先计算分辨率、色深和目标帧率所需的字节数，再看 SPI、RGB 或 MIPI 接口能否提供足够带宽。若面板总线先饱和，继续优化控件绘制不会让画面更快。

## `flush_ready` 太早或太晚都会出问题

若驱动在 DMA 还没完成时就通知 LVGL 缓冲可复用，下一次绘制会覆盖正在发送的像素；若完成后忘记通知，界面会停在等待状态。使用 cache 的系统还要在 DMA 读缓冲前清理或同步 cache。遇到花屏、局部闪烁或偶发旧帧时，先把 flush 起止、DMA 完成和缓冲复用的时间线打出来。

参考：[LVGL](https://github.com/lvgl/lvgl)
