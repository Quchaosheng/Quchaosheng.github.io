---
title: 设备树调试：从 compatible 到驱动 probe
date: 2026-07-29 13:20:00
categories: [技术, 嵌入式Linux]
tags: [设备树, DTS, 驱动调试]
---

设备树描述不能由硬件自动枚举的平台设备，包括地址、中断、时钟、GPIO 和设备间引用。调试重点是确认“编译结果是否进入运行系统、节点是否启用、资源是否正确、驱动是否匹配”。

## 排查顺序

先确认实际加载的 DTB，再检查 `/sys/firmware/devicetree/base` 中的运行时树。随后核对 compatible 与驱动表、status、reg、interrupts、clocks 等属性，最后查看 probe 日志和延迟探测状态。

<div class="note-flow"><span>DTS 编译为 DTB</span><i>→</i><span>Bootloader 传给内核</span><i>→</i><span>内核创建设备</span><i>→</i><span>compatible 匹配</span><i>→</i><span>probe 获取资源</span></div>

## 记忆要点

- `reg` 的单元数量由父节点的 `#address-cells/#size-cells` 决定。
- 中断号必须结合 interrupt-parent 和对应 binding 解读。
- 不要只看源码 DTS，要看系统实际启动使用的设备树。

参考：[吃透设备树调试，嵌入式面试稳拿分](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247495130&idx=1&sn=2fcc1daca481b12c6bba87978b582910)
