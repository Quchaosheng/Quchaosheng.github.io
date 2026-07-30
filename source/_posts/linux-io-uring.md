---
title: io_uring：用共享环减少异步 I/O 开销
date: 2026-04-09 10:00:00
permalink: /2026/07/29/linux-io-uring/
categories: [技术, Linux内核]
tags: [io_uring, 异步IO, 性能]
---

`io_uring` 通过用户态与内核共享的提交环（SQ）和完成环（CQ）批量传递 I/O 请求，减少系统调用、数据复制和上下文切换。

## 请求生命周期

应用填写 SQE 并推进队尾，内核消费请求并执行 I/O，完成后写入 CQE。应用读取 CQE 获取结果。批量提交、固定缓冲区和注册文件可进一步减少开销。

<div class="note-flow"><span>应用填写 SQE</span><i>→</i><span>提交到 SQ</span><i>→</i><span>内核执行 I/O</span><i>→</i><span>结果写入 CQE</span><i>→</i><span>应用收割完成事件</span></div>

## 记忆要点

- SQ/CQ 是通信结构，真正 I/O 是否异步仍取决于操作类型和内核支持。
- zero-copy、SQPOLL 等能力有额外约束，不应默认开启。
- 使用前必须考虑队列深度、背压、取消和错误处理。

参考：[不懂 io_uring，别再说你懂 Linux 内核了](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494637&idx=1&sn=781ea91aebf0ab18a253192b50904eb7)
