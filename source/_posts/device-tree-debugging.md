---
title: 设备树调试：从 compatible 到驱动 probe
date: 2026-04-19 14:00:00
permalink: /2026/07/29/device-tree-debugging/
categories: [技术, 嵌入式Linux]
tags: [设备树, DTS, 驱动调试]
---

设备树解决的是“这块不可自动枚举的硬件如何被内核认识”。它描述寄存器地址、中断、时钟、复位、GPIO、DMA、供电和设备间引用；内核根据节点创建设备，再用 `compatible` 匹配驱动并执行 probe。设备树调试最常见的陷阱是只改了源码 DTS，却没有确认编译出的 DTB、Bootloader 实际加载的 DTB 和运行时内核看到的树是同一份。

<div class="note-flow"><span>DTS 编译为 DTB</span><i>→</i><span>Bootloader 传给内核</span><i>→</i><span>内核创建设备</span><i>→</i><span>compatible 匹配</span><i>→</i><span>probe 获取资源</span></div>

## 先验证“运行时树”而不是源码

内核会在 `/sys/firmware/devicetree/base` 暴露运行时设备树；它是二进制 DTB 解析后的真实视图。应先确认目标节点是否存在、`status` 是否为 `okay`、`compatible` 是否正确，再看地址、中断、时钟和 phandle 引用。字符串属性以 NUL 结尾，二进制单元以大端编码，直接 `cat` 时不要误解输出。

<div class="note-map"><span><b>源码 DTS/DTSI</b><small>开发时编辑的描述，可能被其他 include/overlay 覆盖</small></span><span><b>编译 DTB</b><small>实际交给 Bootloader 的二进制树，要确认路径和版本</small></span><span><b>运行时树</b><small>/sys/firmware/devicetree/base，排查必须以它为准</small></span><span><b>compatible</b><small>决定可匹配哪些驱动；字符串顺序和 binding 都有语义</small></span><span><b>资源属性</b><small>reg/interrupts/clocks/resets/dmas 需按父节点与 binding 解读</small></span><span><b>probe/defer</b><small>依赖未就绪会延迟 probe，不等于驱动没匹配</small></span></div>

## 一条稳定的排查顺序

```bash
# 在目标板确认节点和属性（路径按实际节点调整）
ls /sys/firmware/devicetree/base
tr -d '\0' < /sys/firmware/devicetree/base/soc/<node>/compatible
dmesg | grep -i -E 'probe|defer|<driver-name>'
```

然后检查驱动的 `of_match_table` 是否包含相同/兼容的字符串；查看 `/sys/bus/*/devices`、`/sys/bus/*/drivers` 判断设备是否创建与绑定；若出现 `-EPROBE_DEFER`，找出它正在等待的时钟、regulator、GPIO 或父设备，而不是强行重试 probe。

## 属性必须结合 binding 和父节点解释

`reg` 的单元数量由父节点的 `#address-cells` 与 `#size-cells` 决定，不能把一串数简单当成一个地址。`interrupts` 必须和 `interrupt-parent`、中断控制器 binding 一起解释；`clocks`、`resets` 和 `dmas` 通常引用其他节点的 phandle，索引含义由对应 provider binding 决定。只看一个 DTS 片段很容易得出错误结论。

设备树绑定是 ABI 文档，不是可自由发挥的注释。优先阅读内核的 YAML binding 和已有同类节点，使用 `dtbs_check` 检查 schema；对新增硬件，把电源、复位、时钟、pinctrl 和中断完整写出，别依赖 Bootloader 留下的偶然状态。

## 最后才去看驱动业务逻辑

运行时节点正确、资源也能获取后，才排查驱动内部传输、寄存器和状态机。这样可以把“设备树没生效”“依赖没起来”“driver probe 失败”和“设备真正不响应”分成不同问题。设备树调试的核心纪律是：从实际 DTB、实际运行时树和实际 dmesg 出发。

参考：[Devicetree specification](https://devicetree-specification.readthedocs.io/) · [Linux Devicetree bindings](https://docs.kernel.org/devicetree/bindings/index.html)
