---
title: fasync 与 SIGIO：Linux 信号驱动异步通知
date: 2026-07-29 13:22:00
categories: [技术, 嵌入式Linux]
tags: [fasync, SIGIO, 字符设备]
---

`fasync` 允许设备状态变化时由驱动向订阅进程发送 `SIGIO`。它适合事件频率不高、只需通知“可以读写”的场景；大量事件通常更适合 poll/epoll 或专用事件队列。

## 建立通知

用户空间设置文件描述符所有者并启用 `O_ASYNC`，VFS 调用驱动的 fasync 回调维护订阅者列表。设备事件到来时，驱动调用 `kill_fasync()`，进程收到信号后再执行实际读写。

<div class="note-flow"><span>应用设置 F_SETOWN</span><i>→</i><span>启用 O_ASYNC</span><i>→</i><span>驱动登记 fasync</span><i>→</i><span>设备事件触发 kill_fasync</span><i>→</i><span>应用收到 SIGIO 并读取</span></div>

## 记忆要点

- 信号只是通知，不应把完整数据塞进信号处理流程。
- 关闭文件时必须从异步队列移除订阅者。
- 信号处理函数只能调用异步信号安全的接口。

参考：[吃透内核 fasync 机制，弄懂信号驱动异步通知](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494999&idx=1&sn=998f50d0caeb7080afac1ac8ee0782fd)
