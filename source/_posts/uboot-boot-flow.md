---
title: U-Boot 启动流程：从上电到跳入 Linux
date: 2026-05-25 14:00:00
permalink: /2026/07/29/uboot-boot-flow/
categories: [技术, 嵌入式Linux]
tags: [U-Boot, 启动, 设备树]
---

嵌入式板子上电后，最先运行的不是 Linux，而是芯片 ROM 中固定的启动代码。ROM 从预设介质读取第一阶段程序；受片上 SRAM 容量限制，这一阶段常是 SPL/TPL，负责最小引脚、时钟和 DRAM 初始化；随后加载完整 U-Boot。U-Boot 再根据环境、bootflow 或脚本找到内核、DTB、initramfs/根文件系统信息，设置启动参数并将控制权交给 Linux。

<div class="note-flow"><span>ROM 加载 SPL</span><i>→</i><span>SPL 初始化 DRAM</span><i>→</i><span>加载 U-Boot proper</span><i>→</i><span>装载 Kernel/DTB</span><i>→</i><span>设置参数并跳转内核</span></div>

## 启动阶段各自承担什么责任

ROM 的能力由芯片固定，通常只知道从某些存储偏移读取并校验少量数据。SPL/TPL 必须在非常受限的 SRAM 里完成 DRAM training、时钟和必要存储驱动初始化。U-Boot proper 在 DRAM 可用后提供命令行、环境变量、网络/存储驱动、镜像验证和更灵活的启动策略。

<div class="note-map"><span><b>ROM</b><small>芯片固化启动逻辑，选择启动介质并加载第一阶段</small></span><span><b>SPL/TPL</b><small>最小硬件初始化，尤其是 DRAM，容量和依赖受严格限制</small></span><span><b>U-Boot proper</b><small>设备发现、环境、脚本、网络、验证和镜像装载</small></span><span><b>Kernel Image</b><small>内核镜像，可能是 Image/zImage/uImage/FIT 的一个组件</small></span><span><b>DTB/initramfs</b><small>硬件描述和可选初始根文件系统，必须与内核和板子匹配</small></span><span><b>bootargs</b><small>传给内核的 root、console、调试和平台参数</small></span></div>

## 地址、格式和一致性是常见故障源

U-Boot 中 kernel、DTB、initramfs 的加载地址不能互相覆盖，也不能覆盖 U-Boot 自身、FDT 工作区或内核解压区域。镜像格式也必须与启动命令匹配：`booti`、`bootz`、`bootm` 处理的镜像类型不同；FIT 可以将 kernel、FDT、ramdisk、哈希/签名组合成一份可验证镜像，但仍要确保配置节点选择的是正确板级 DTB。

```text
加载镜像 -> 校验大小/哈希 -> 检查加载地址与保留区
        -> 设置 bootargs -> 传入 kernel + FDT (+ initramfs)
        -> 跳转后观察第一条内核串口输出
```

不要因为“U-Boot 已经显示 Loaded”就假设内核一定拿到了正确数据。应在 U-Boot 中检查内存内容、FDT 信息和环境变量，并把最终命令行写入启动日志。

## 按最后一条日志分层排障

串口完全无输出，先查 ROM/SPL、供电、时钟和串口引脚；SPL 输出后死在 DRAM，查 training/时序；U-Boot 能起来却无法加载镜像，查存储、分区、文件系统和地址；“Starting kernel ...”后无输出，查 console、DTB、内核镜像和启动参数；内核有输出却挂根失败，则转向 root=、驱动和 rootfs。

安全启动或 OTA 场景还要验证镜像签名、回滚计数、A/B 槽选择和掉电恢复。启动链是信任链与恢复链的一部分，不应只在正常镜像上测试一次。

参考：[U-Boot Documentation](https://docs.u-boot.org/) · [U-Boot bootflow](https://docs.u-boot.org/en/latest/develop/bootstd/overview.html)
