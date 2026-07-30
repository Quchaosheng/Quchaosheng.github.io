---
title: fork、exec 与 COW：进程是怎样创建的
date: 2026-07-29 16:09:18
source_checked_at: 2026-07-29 16:09:18
permalink: /2026/07/29/linux-fork-exec-cow/
categories: [技术, Linux内核]
tags: [fork, exec, COW, 进程]
---

`fork()` 创建当前进程的逻辑副本，`exec()` 用新程序替换当前进程映像。为了避免 fork 时复制全部物理内存，Linux 使用写时复制（COW）：父子进程先共享只读页面，真正写入时才复制。

## 创建流程

内核复制进程描述信息和页表引用，并把共享页设置为不可写。任一方写入会触发保护性缺页异常，内核分配新页、复制内容并更新写入方页表。

<div class="note-flow"><span>父进程调用 fork</span><i>→</i><span>父子共享物理页</span><i>→</i><span>某一方尝试写入</span><i>→</i><span>COW 缺页异常</span><i>→</i><span>复制并建立私有页</span></div>

## 记忆要点

- fork 返回两次：父进程得到子 PID，子进程得到 0。
- exec 成功后不会返回，PID 不变但代码、数据和栈被替换。
- COW 省的是“不必要的物理页复制”，页表等元数据仍有成本。

参考：[不懂进程 fork/exec 与 COW，别再说你懂 Linux 内核了](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494604&idx=1&sn=3d3ec9c1a922d624b7267b3690be0a6e)
