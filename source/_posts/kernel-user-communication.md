---
title: 内核与用户空间通信：按语义选择接口
date: 2026-07-29 14:10:00
categories: [技术, Linux内核]
tags: [Netlink, ioctl, mmap]
---

内核可通过系统调用、ioctl、procfs/sysfs、debugfs、Netlink、mmap 和信号等方式与用户空间交互。选择标准是数据方向、频率、结构稳定性和是否需要事件通知。

<div class="note-flow"><span>明确配置/状态/数据/事件语义</span><i>→</i><span>选择稳定接口</span><i>→</i><span>校验用户输入</span><i>→</i><span>传输或映射数据</span><i>→</i><span>处理版本与并发</span></div>

sysfs 适合单值设备属性，Netlink 适合结构化双向消息，mmap 适合大数据共享，debugfs 只用于调试且不保证 ABI 稳定。

参考：[Linux 内核空间与用户空间信息交互](https://www.kerneltravel.net/blog/2020/kernel_user/)
