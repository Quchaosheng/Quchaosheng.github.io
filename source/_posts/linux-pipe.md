---
title: Linux 管道：内核缓冲区上的字节流 IPC
date: 2026-05-02 14:00:00
permalink: /2026/07/29/linux-pipe/
categories: [技术, Linux内核]
tags: [管道, IPC, 文件描述符]
---

管道是内核维护的单向字节流缓冲区，读端和写端通过文件描述符访问。它适合具有亲缘关系的进程或 shell 命令串联，数据不需落盘。

<div class="note-flow"><span>创建 pipe</span><i>→</i><span>写端写入内核缓冲区</span><i>→</i><span>等待的读端被唤醒</span><i>→</i><span>读端取走字节流</span></div>

管道不是消息队列：读取边界不等于写入边界。小于 `PIPE_BUF` 的单次写入可获得原子性保证；无人读时写入会收到 `SIGPIPE` 或 `EPIPE`。容量、阻塞模式与关闭无用端决定其行为。

参考：[Linux 管道到底有多快？](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247484234&idx=1&sn=093188234f2724489a70ab419752f4da)
