---
title: 设备树 Overlay：运行时修改硬件描述
date: 2026-07-29 13:46:00
categories: [技术, 嵌入式Linux]
tags: [设备树, Overlay, 驱动]
---

一块主板可能接不同扩展板，或者同一产品在出厂后才决定启用某个外设。为每种组合维护完整 DTB 很快会重复且难以维护。设备树 Overlay（DTBO）提供增量描述：它通过 fragment 找到基础树中的目标节点，添加子节点、修改属性或启用/禁用节点；内核/Bootloader 在合适阶段将其合并到基础 DTB。它适合硬件组合变化，却不是可以随时热改任意设备状态的魔法补丁。

<div class="note-flow"><span>编译基础 DTB 与 DTBO</span><i>→</i><span>解析 fragment 目标</span><i>→</i><span>合并属性和节点</span><i>→</i><span>创建设备并触发 probe</span><i>→</i><span>卸载时按依赖回滚</span></div>

## Overlay 怎样找到要修改的节点

fragment 使用 `target`（phandle）或 `target-path` 指向基础树节点，再在 `__overlay__` 中描述变化。为让编译器保留可引用的标签和符号，基础 DTB 与 overlay 通常需要以支持符号的方式编译；编译产物会包含 `__symbols__`、`__fixups__`、`__local_fixups__` 等帮助合并器修正引用。

<div class="note-map"><span><b>基础 DTB</b><small>提供稳定的节点、label 和符号，是 Overlay 的依赖基础</small></span><span><b>fragment</b><small>选择目标节点，并声明要合并的属性/子节点</small></span><span><b>target/target-path</b><small>分别用 phandle 或字符串路径定位目标</small></span><span><b>fixups</b><small>合并时修正跨树 phandle/符号引用，避免引用落到错误节点</small></span><span><b>设备创建</b><small>合并后可能触发平台/SPI/I2C 等设备创建与驱动 probe</small></span><span><b>移除约束</b><small>存在引用、正在使用的设备或叠加依赖时不能随意卸载</small></span></div>

```dts
/dts-v1/;
/plugin/;

&spi0 {
    status = "okay";
    sensor@0 { compatible = "vendor,sensor"; reg = <0>; };
};
```

示例只展示表达方式。真实节点还必须按 binding 补齐 `spi-max-frequency`、中断、供电、复位、pinctrl 等依赖，不能因为基础板恰好残留了某种引脚状态就省略。

## 编译和应用时要确认什么

常见做法是使用 `dtc -@` 生成带符号的 DTBO；Bootloader 可以在启动时合并，Linux 也可在配置支持时通过 configfs 动态应用。无论在哪一层应用，排查时都应看最终运行时树，确认目标属性真的已合并、设备被创建并且驱动 probe 成功。

```bash
dtc -@ -I dts -O dtb -o board-addon.dtbo board-addon.dts
ls /sys/kernel/config/device-tree/overlays 2>/dev/null
```

路径可用不代表所有 overlay 都适合动态装卸。应用时的错误应保留完整日志，特别是符号缺失、phandle fixup 失败、节点已存在与驱动 probe defer。

## 卸载比加载更难

Overlay 添加的设备可能已经被其他驱动、用户态 fd、regulator、clock 或另一个 overlay 引用。移除时内核需要撤销设备和依赖，任何一个仍在使用都可能使操作失败或造成风险。对于真正可插拔的模块，应先设计设备撤销、资源关闭、引用释放和用户态通知，再把 Overlay 当作描述层。

Overlay 最适合表达“硬件组合发生变化”，而不是替代运行时的设备状态机。基础 DTB 和 DTBO 都应受版本管理、schema 检查与实机测试约束。

参考：[Devicetree Overlay Notes](https://docs.kernel.org/devicetree/overlay-notes.html) · [dtc](https://www.kernel.org/doc/html/latest/devicetree/usage-model.html)
