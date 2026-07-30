---
title: open 系统调用：路径怎样变成文件描述符
date: 2026-05-28 14:00:00
permalink: /2026/07/29/open-system-call/
categories: [技术, Linux内核]
tags: [open, VFS, 系统调用]
---

`openat` 从系统调用入口进入 VFS，完成路径解析、权限检查与文件对象创建，最后把 `struct file` 安装到进程文件描述符表。

<div class="note-flow"><span>用户传入路径和 flags</span><i>→</i><span>复制参数并分配 fd</span><i>→</i><span>VFS 路径查找</span><i>→</i><span>创建/打开 inode</span><i>→</i><span>安装 file 并返回 fd</span></div>

fd 是进程表中的整数索引；`struct file` 表示一次打开实例；inode 表示底层文件对象。多个 fd 可以引用同一个 file 或同一个 inode。

参考：[open 系统调用](https://www.kerneltravel.net/blog/2021/open_syscall_szp1/)
