---
title: Linux 五种 I/O 模型：阻塞、非阻塞与多路复用
date: 2026-07-29 13:27:00
categories: [技术, Linux网络]
tags: [I/O模型, epoll, 网络编程]
---

常见分类包括阻塞 I/O、非阻塞 I/O、I/O 多路复用、信号驱动 I/O 与异步 I/O。区别在于“谁等待数据就绪、谁执行数据搬运”，而不只是 API 名称。

<div class="note-flow"><span>应用发起读请求</span><i>→</i><span>内核等待数据就绪</span><i>→</i><span>通知或唤醒应用</span><i>→</i><span>复制数据并返回</span></div>

**记忆要点**：阻塞 I/O 最简单；非阻塞 I/O 需要轮询；select/poll/epoll 用一个线程观察多个 fd；真正异步 I/O 是内核完成后直接报告结果。高并发网络服务器通常选择非阻塞 socket 加 epoll，再配合 Reactor。

参考：[Linux 网络五种 I/O 模型](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247484015&idx=1&sn=4af7a10de06249ae1a3004bb954bcee0)
