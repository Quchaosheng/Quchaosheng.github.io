---
title: Buildroot：生成可复现的嵌入式 Linux 系统镜像
date: 2026-07-29 14:32:00
categories: [技术, 嵌入式Linux]
tags: [Buildroot, 根文件系统, 交叉编译]
---

Buildroot 统一生成交叉工具链、Bootloader、内核、根文件系统和用户软件包。配置确定版本与依赖，构建系统下载源码、交叉编译并产出镜像。

<div class="note-flow"><span>选择 defconfig</span><i>→</i><span>锁定工具链与软件版本</span><i>→</i><span>构建 U-Boot/Kernel/Packages</span><i>→</i><span>生成 rootfs 与镜像</span><i>→</i><span>烧录并进行启动测试</span></div>

自定义内容应放在 br2-external、overlay 和 package 中，避免直接修改 Buildroot 源树。参考：[Buildroot](https://buildroot.org/)
