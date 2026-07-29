---
title: select、poll 与 epoll：多路复用如何扩展
date: 2026-07-29 13:43:00
categories: [技术, Linux网络]
tags: [select, poll, epoll, Reactor]
---

三者都用于等待多个文件描述符就绪。select 有 fd 数量限制且每次传递位图；poll 去掉固定上限但仍线性扫描；epoll 把关注集合保存在内核，并返回就绪事件。

<div class="note-flow"><span>注册感兴趣的 fd</span><i>→</i><span>内核监听就绪事件</span><i>→</i><span>epoll_wait 返回就绪列表</span><i>→</i><span>Reactor 分派读写处理</span></div>

边缘触发要求一次读写到 `EAGAIN`，否则可能错过后续通知；水平触发更易正确。epoll 不是“绝对 O(1)”，应用仍需正确管理连接、事件与背压。

参考：[epoll、poll、select 的区别](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247484469&idx=1&sn=3e4486b632c564e302f6a534070192b1)
