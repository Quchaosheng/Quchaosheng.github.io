---
title: open 系统调用：路径怎样变成文件描述符
date: 2026-04-06 14:00:00
permalink: /2026/07/29/open-system-call/
categories: [技术, Linux内核]
tags: [open, VFS, 系统调用]
---

`openat` 从系统调用入口进入 VFS，完成路径解析、权限检查与文件对象创建，最后把 `struct file` 安装到进程文件描述符表。看起来只是返回一个整数，但这个过程中既要解释路径、穿过挂载点和符号链接，也要处理创建、权限、锁和文件偏移等语义。

<div class="note-flow"><span>用户传入路径和 flags</span><i>→</i><span>复制参数并分配 fd</span><i>→</i><span>VFS 路径查找</span><i>→</i><span>创建/打开 inode</span><i>→</i><span>安装 file 并返回 fd</span></div>

<figure class="note-visual"><figcaption><span>对象图</span>fd、`struct file` 和 inode 分别属于进程表、一次打开和底层文件对象。</figcaption><div class="note-map"><span><b>路径参数</b><small>相对路径从当前目录或 `dirfd` 出发，绝对路径从根开始。</small></span><span><b>namei</b><small>逐段查找 dentry、处理挂载点、权限和符号链接。</small></span><span><b>inode</b><small>描述底层对象的元数据和文件系统操作。</small></span><span><b>struct file</b><small>表示一次打开实例，包含 flags、当前位置和操作表。</small></span><span><b>fd table</b><small>进程用整数索引引用 `struct file`，可被复制或关闭。</small></span><span><b>创建语义</b><small>`O_CREAT`、`O_EXCL`、`O_TRUNC` 会改变查找后的行为。</small></span></div></figure>

## 三个对象解释很多“奇怪现象”

fd 只是进程文件表中的索引；`struct file` 才保存一次打开实例的状态；inode 表示底层文件。两个独立的 `open()` 可指向同一 inode 却拥有各自的文件偏移；`dup()` 或 `fork()` 得到的 fd 则可能引用同一个 `struct file`，因此共享偏移和状态。理解这层关系后，很多并发读写和关闭顺序问题就不再神秘。

## 路径安全不能只靠字符串拼接

服务程序如果把用户输入拼进路径，再调用普通 `open()`，可能受到符号链接、目录替换和路径穿越影响。`openat` 系列让程序从受控目录 fd 出发；需要更严格约束时，可考虑 `openat2` 的 resolve 语义。无论使用什么接口，都要先明确允许跨越哪些目录、挂载点和链接，而不是在错误发生后再过滤字符串。

参考：[open 系统调用](https://www.kerneltravel.net/blog/2021/open_syscall_szp1/)
