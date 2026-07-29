---
title: DMA：设备怎样绕过 CPU 搬运大块数据
date: 2026-07-29 13:39:00
categories: [技术, 嵌入式Linux]
tags: [DMA, 设备驱动, 缓存一致性]
---

DMA 控制器让设备直接在内存与设备缓冲区之间传输数据，CPU 只负责设置描述符和处理完成中断，避免逐字节复制。

<div class="note-flow"><span>驱动映射缓冲区</span><i>→</i><span>配置 DMA 描述符</span><i>→</i><span>设备读写内存</span><i>→</i><span>DMA 完成中断</span><i>→</i><span>驱动解除映射并处理数据</span></div>

DMA 的难点是地址转换、缓存一致性和缓冲区生命周期。流式 DMA 需要在 CPU 与设备交接前后同步缓存；不要把普通虚拟地址直接交给硬件。

参考：[Linux DMA 技术](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247485365&idx=1&sn=f3c867f73c819101d1dd2b70aec283d1)
