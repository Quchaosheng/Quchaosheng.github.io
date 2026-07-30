---
title: select、poll 与 epoll：多路复用如何扩展
date: 2026-03-06 14:00:00
permalink: /2026/07/29/select-poll-epoll/
categories: [技术, Linux网络]
tags: [select, poll, epoll, Reactor]
---

网络服务器往往需要同时等待大量 socket、定时器、管道或 eventfd，而不是为每个 fd 创建一个阻塞线程。`select`、`poll` 与 `epoll` 都实现“等待多个 fd 是否就绪”，区别在于关注集合如何传给内核、就绪集合怎样返回、每轮需要扫描多少对象。理解它们的重点不只是复杂度，更是就绪通知、非阻塞 I/O、连接生命周期和背压如何配合。

<div class="note-flow"><span>注册感兴趣的 fd</span><i>→</i><span>内核监听就绪事件</span><i>→</i><span>epoll_wait 返回就绪列表</span><i>→</i><span>Reactor 分派读写处理</span></div>

## select、poll、epoll 的核心差异

`select` 每轮传递 fd 位图，受 `FD_SETSIZE` 等接口限制，返回后应用还要扫描集合。`poll` 用数组描述 fd，去掉固定小上限，但仍需每轮扫描所有关注项。`epoll` 将关注集合保存到内核，应用先 `epoll_ctl()` 添加/修改/删除，再由 `epoll_wait()` 取得就绪事件列表，因此适合连接数多、活跃比例低的场景。

<div class="note-map"><span><b>select</b><small>位图接口，简单但有集合大小与每轮扫描限制</small></span><span><b>poll</b><small>数组接口，无固定小上限，仍需线性检查关注集合</small></span><span><b>epoll</b><small>内核维护兴趣集合，返回就绪列表，适合大量 idle 连接</small></span><span><b>水平触发 LT</b><small>只要 fd 仍可读/写就持续通知，较易正确</small></span><span><b>边缘触发 ET</b><small>状态变化时通知，需一次处理到 EAGAIN，减少重复事件</small></span><span><b>EPOLLONESHOT</b><small>一次事件后需显式 rearm，便于多线程避免重复处理同一 fd</small></span></div>

## ET 模式为什么经常“丢事件”

边缘触发不是把水平触发换成更快的开关。它只在从“不可读”变成“可读”时通知；收到事件后若应用只读了一点就返回，fd 仍处于可读状态却不会再次发生边缘变化，于是剩余数据可能一直躺在内核缓冲区。正确模式是将 fd 设为 nonblocking，在事件回调中循环读/写直到返回 `EAGAIN`。

```c
for (;;) {
    ssize_t n = recv(fd, buf, sizeof buf, 0);
    if (n > 0) { handle(buf, n); continue; }
    if (n < 0 && errno == EAGAIN) break;
    if (n == 0 || (n < 0 && errno != EINTR)) close_connection(fd);
}
```

这段逻辑还需要处理半包、写缓冲、关闭事件和连接对象生命周期。事件循环正确性通常比 `epoll_wait()` 本身更难。

## Reactor 仍然需要背压

epoll 能告诉你“现在可以写”，不代表你应该无限生产数据。若对端慢、发送缓冲满或业务处理落后，应用需要有界队列、高低水位线、暂停读/恢复读和超时策略。对实时消息更要记录数据年龄：宁可丢弃过期状态，也不要让它在事件循环队列里排到失去意义。

选择哪种接口应由连接数量、活跃比例、团队熟悉度和正确性需求决定。几百个稳定连接用 poll 也可能足够；数十万闲连接则更适合 epoll。先写清生命周期和背压，再追求事件模型的理论复杂度。

参考：[epoll(7)](https://man7.org/linux/man-pages/man7/epoll.7.html) · [select(2)](https://man7.org/linux/man-pages/man2/select.2.html)
