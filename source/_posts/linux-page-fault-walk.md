---
title: 缺页异常与页表遍历：一次内存访问的补救过程
date: 2026-06-18 14:10:00
permalink: /2026/07/29/linux-page-fault-walk/
categories: [技术, Linux内核]
tags: [缺页异常, 页表, 虚拟内存]
---

缺页异常不一定是错误。它表示 MMU 无法按当前页表完成访问，可能因为页面尚未分配、文件页尚未载入、COW 写入，或访问权限确实非法。

## 内核处理路径

CPU 保存现场进入异常处理，内核先找到对应 VMA，检查地址与权限，再根据 VMA 类型分配匿名页、读取文件页或执行 COW。无法修复时，用户进程通常收到 `SIGSEGV` 或 `SIGBUS`。

<div class="note-flow"><span>TLB 未命中</span><i>→</i><span>页表遍历失败</span><i>→</i><span>进入缺页处理</span><i>→</i><span>验证 VMA 与权限</span><i>→</i><span>补页或发送信号</span></div>

## 记忆要点

- minor fault 不需磁盘 I/O，major fault 通常需要读取外部存储。
- VMA 描述一段虚拟地址范围的合法用途，页表记录具体页面映射。
- demand paging 让程序只为真正访问的页面付出成本。

参考：[不懂缺页异常与页表遍历，别再说你懂 Linux 内核了](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494630&idx=1&sn=a62e73e92a27290032f4c1c7f8887b3a)
