---
title: Linux 内核启动：从固件到第一个用户进程
date: 2026-03-02 10:00:00
permalink: /2026/07/29/linux-kernel-boot/
categories: [技术, Linux内核]
tags: [内核启动, Bootloader, init]
---

Linux 内核启动不是一条黑盒“跳进去就好了”的路径，而是一系列职责交接：固件/ROM 将控制权给 Bootloader；Bootloader 把内核镜像、设备树和可选 initramfs 放到内存；架构入口建立最小执行环境；内核解压、初始化内存管理、中断、调度、驱动与 VFS；最后挂载真正 rootfs 并执行 PID 1。任何一层传递的数据、地址、时钟或命令行不一致，都可能在下一层以完全不同的症状出现。

<div class="note-flow"><span>固件/ROM</span><i>→</i><span>Bootloader</span><i>→</i><span>解压并进入内核</span><i>→</i><span>初始化内存与驱动</span><i>→</i><span>挂载根文件系统并启动 init</span></div>

## 内核接手后发生了什么

架构相关入口先建立栈、异常向量、早期页表和 CPU 基础状态；随后进入通用初始化，解析 bootargs 和 DTB，建立内存 zone/伙伴系统、调度器、定时器、IRQ、console，按 initcall 层级初始化驱动和子系统。initramfs 若存在会先作为早期 rootfs 使用，最终由 VFS 根据 `root=`、`rootfstype=` 等参数找到并挂载真正根文件系统。

<div class="note-map"><span><b>early boot</b><small>架构入口、早期 console、页表与 CPU 基础状态</small></span><span><b>DTB/bootargs</b><small>硬件资源与启动参数，决定驱动/根文件系统/console 如何工作</small></span><span><b>核心子系统</b><small>内存、调度、IRQ、timekeeping、VFS 等建立通用运行环境</small></span><span><b>initcall</b><small>驱动和子系统按层级初始化，probe 可能因依赖暂缓</small></span><span><b>rootfs</b><small>initramfs 或块/网络根文件系统，必须有对应驱动与参数</small></span><span><b>PID 1</b><small>内核找到并执行 init，失败会导致 kernel panic</small></span></div>

## 最后一条日志是最好的分界线

没有任何串口输出，先确认 Bootloader 的 `console=` 与内核早期 console 支持；看到“Uncompressing Linux”后停住，检查镜像、内存、加载地址和架构入口；能看到内核日志但没有设备，查 DTB/驱动/时钟；出现 `VFS: Unable to mount root fs`，查 `root=`、存储驱动、文件系统和分区；出现 `No working init found`，查 rootfs 中 `/sbin/init`、动态链接器和权限。

```text
无 Bootloader 日志 -> ROM/SPL/串口
Starting kernel 后无输出 -> image/DTB/console/地址
VFS mount 失败 -> root= / block driver / filesystem
PID 1 失败 -> rootfs 内容、ABI、init 权限和依赖
```

按阶段定位比同时修改 kernel config、设备树和 rootfs 更快。每次实验尽量只改变一个输入，并保存完整串口日志；启动问题最怕“改了五处后突然好了”，下一次就无法复现。

## 让启动链可调试、可恢复

保留可靠的 earlycon/串口日志、panic 信息、Bootloader 环境导出和镜像版本标识；在开发阶段允许从网络/USB 启动以缩短迭代；在产品阶段则需要明确签名验证、A/B 回滚、失败计数和恢复路径。启动成功只是一种状态，失败后能否看见、能否回退、能否定位才是工程质量。

参考：[Linux kernel booting](https://docs.kernel.org/admin-guide/bootconfig.html) · [The kernel's command-line parameters](https://docs.kernel.org/admin-guide/kernel-parameters.html)
