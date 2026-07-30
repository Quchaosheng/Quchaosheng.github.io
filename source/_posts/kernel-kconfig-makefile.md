---
title: Kconfig、Makefile 与 .config：驱动代码如何进入内核
date: 2026-07-10 14:10:00
permalink: /2026/07/29/kernel-kconfig-makefile/
categories: [技术, Linux内核]
tags: [Kconfig, Makefile, 内核构建]
---

给内核添加一份 `.c` 文件并不会让它自动参与构建。Kconfig 负责描述功能选项、依赖、帮助文本和可见性；配置工具据此生成 `.config` 与自动生成头文件；Kbuild Makefile 再依据 `CONFIG_*` 的值选择将对象编入内核、构建为模块或完全跳过。三层必须同时接通，才能解释“menuconfig 里能看到但代码没编”“模块没有生成”“符号依赖为什么消失”。

<div class="note-flow"><span>编写 Kconfig 选项</span><i>→</i><span>menuconfig 解析依赖</span><i>→</i><span>生成 .config/autoconf</span><i>→</i><span>Kbuild 选择 obj-y/obj-m</span><i>→</i><span>链接内核或生成 .ko</span></div>

## Kconfig 表达的是可选性和依赖

`bool` 只能是 `y/n`，适合必须内建或关闭的功能；`tristate` 可为 `y/m/n`，允许构建成模块。`depends on` 表达用户必须先满足的前置条件；`select` 会强制打开另一个符号，因此应谨慎使用，避免绕开该符号自身依赖导致不完整配置。

<div class="note-map"><span><b>config symbol</b><small>CONFIG_FOO 的定义，包含类型、默认值、depends/select 与 help</small></span><span><b>depends on</b><small>限制选项可见/可选，适合表达真实硬件和子系统前置条件</small></span><span><b>select</b><small>强制启用依赖，容易绕过复杂依赖，只应用于无前置条件的 helper</small></span><span><b>.config</b><small>配置工具产物，是当前构建的唯一配置事实</small></span><span><b>obj-y</b><small>链接进 vmlinux；启动即存在，不能动态卸载</small></span><span><b>obj-m</b><small>构建为 .ko 模块；仍要满足模块加载与符号依赖</small></span></div>

```make
# Makefile：CONFIG_VENDOR_SENSOR=y -> vendor_sensor.o 进内核
#          CONFIG_VENDOR_SENSOR=m -> vendor_sensor.ko 模块
obj-$(CONFIG_VENDOR_SENSOR) += vendor_sensor.o
```

Kbuild 还会处理目录递归、复合对象、模块信息和链接顺序。新增驱动目录时，既要让父级 Kconfig `source` 到子 Kconfig，也要让父级 Makefile 进入子目录；只接其中一边都会造成看似诡异的结果。

## 一条可重复的配置工作流

从已知 defconfig 开始，使用 `make menuconfig` 或 `nconfig` 修改，随后运行 `make olddefconfig` 让新选项获得合理默认值，最后用 `make savedefconfig` 保存最小差异。不要只复制完整 `.config` 却不记录内核版本和工具链；选项名、依赖和默认值会随版本改变。

```bash
make <board>_defconfig
make menuconfig
make olddefconfig
make savedefconfig
grep CONFIG_VENDOR_SENSOR .config
```

构建后检查 `vmlinux`/模块目录、`modinfo` 和目标机 `dmesg`。若是模块，确认 `CONFIG_MODULES`、依赖模块、安装路径、模块签名与目标内核版本一致；“编过了”不代表目标机能加载。

## 配置是产品接口的一部分

内核配置决定驱动、文件系统、网络、安全和调试能力，应该与 DTS、Bootloader 参数、rootfs 模块和 CI 一起版本化。为量产关闭调试选项之前，先保留可诊断的替代路径；为缩小镜像删除功能之前，确认恢复、OTA 和现场故障处理不依赖它。Kconfig 不是一个菜单，而是内核能力和产品约束的正式声明。

参考：[Kconfig Language](https://docs.kernel.org/kbuild/kconfig-language.html) · [Kbuild](https://docs.kernel.org/kbuild/makefiles.html)
