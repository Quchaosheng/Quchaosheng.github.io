---
title: Linux 管道：内核缓冲区上的字节流 IPC
date: 2026-05-01 10:00:00
source_checked_at: 2026-07-29 17:36:41
permalink: /2026/07/29/linux-pipe/
categories: [技术, Linux内核]
tags: [管道, IPC, 文件描述符]
---

管道是内核维护的单向字节流缓冲区，读端和写端通过文件描述符访问。它适合 shell 命令串联或具有亲缘关系的进程通信，数据不需要落盘。它的简单也有边界：管道传的是连续字节，不会替应用保存“这一段是第几条消息”。

<div class="note-flow"><span>创建 pipe</span><i>→</i><span>写端写入内核缓冲区</span><i>→</i><span>等待的读端被唤醒</span><i>→</i><span>读端取走字节流</span></div>

<figure class="note-visual"><figcaption><span>数据图</span>写入、缓冲、读取和端点关闭共同决定管道的可见行为。</figcaption><div class="note-map"><span><b>读端 fd</b><small>读取字节流，所有写端关闭后会读到 EOF。</small></span><span><b>写端 fd</b><small>写入缓冲区；没有读端时会得到 SIGPIPE 或 EPIPE。</small></span><span><b>内核缓冲</b><small>容量有限，满时阻塞或返回 EAGAIN，取决于阻塞模式。</small></span><span><b>PIPE_BUF</b><small>不超过该阈值的一次写入可避免与其他写者交错。</small></span><span><b>消息边界</b><small>read 可返回任意长度，协议需要自行处理粘连和拆分。</small></span><span><b>关闭无用端</b><small>fork 后必须关闭不使用的端点，否则 EOF 和 SIGPIPE 都会失真。</small></span></div></figure>

## 用长度或分隔符定义消息边界

若要通过管道传递多条记录，应用层需要使用固定长度、长度前缀或安全的分隔协议。一次 `write()` 不一定对应一次 `read()`；读者可能得到半条记录，也可能一次拿到多条。`PIPE_BUF` 原子性只解决多个写者交错的问题，不会自动给读者恢复消息边界。

## EOF 和 SIGPIPE 常常暴露 fd 泄漏

调用 `fork()` 后，父子进程都拥有两端 fd。每个进程都应尽早关闭不使用的一端，否则读者会因为仍有隐藏写端而永远等不到 EOF，写者也不会及时收到没有读者的错误。调试管道卡住时，先检查进程实际持有哪些 fd，往往比盯着读写循环更有效。

参考：[Linux 管道到底有多快？](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247484234&idx=1&sn=093188234f2724489a70ab419752f4da)
