---
title: Linux 共享内存：少复制不等于零成本
date: 2026-07-29 16:09:18
source_checked_at: 2026-07-29 16:09:18
permalink: /2026/07/29/linux-shared-memory/
categories: [技术, Linux内核]
tags: [共享内存, IPC, mmap]
description: 从 POSIX 共享内存、mmap、缓存一致性和跨进程协议出发，说明少复制通信仍需承担的同步与恢复成本。
---

共享内存让多个进程把同一个后备对象映射到各自虚拟地址空间。映射建立后，进程可以直接读写同一组物理页，适合传递图像、传感器帧或大块环形缓冲区。但它只解决“数据放在哪里”，不解决谁能写、什么时候可读、进程崩溃后怎样恢复。

## 建立映射的四个步骤

POSIX 共享内存通常由生产者 `shm_open()` 创建，通过 `ftruncate()` 设定大小，再以 `MAP_SHARED` 调用 `mmap()`。消费者用约定名称打开同一对象并映射。`shm_unlink()` 删除名称，但和普通文件一样，已有描述符与映射可以继续存活到最后一个引用释放。

<div class="note-flow"><span>创建共享对象</span><i>→</i><span>两个进程分别 mmap</span><i>→</i><span>页表指向相同物理页</span><i>→</i><span>同步发布数据</span><i>→</i><span>对端直接读取</span></div>

<div class="note-map"><span><b>后备对象</b><small>shm_open、memfd 或普通文件</small></span><span><b>各自虚拟地址</b><small>地址可以不同，不能传递裸指针</small></span><span><b>共享物理页</b><small>避免在进程间复制整个负载</small></span><span><b>控制区</b><small>版本、长度、读写索引和状态</small></span><span><b>同步原语</b><small>互斥锁、信号量、futex 或原子变量</small></span><span><b>恢复协议</b><small>处理超时、崩溃与陈旧对象</small></span></div>

## “零拷贝”省掉了什么

相较于管道或 socket 中转大块负载，共享内存可以省去生产者缓冲区到内核缓冲区、再到消费者缓冲区的复制。但首次访问仍可能缺页，多个 CPU 之间仍要维护缓存一致性；同步变量还可能产生 cache line 抖动。若设备 DMA 参与链路，还要另外满足设备映射和缓存一致性要求，不能仅凭共享内存就宣称端到端零拷贝。

## 协议比映射更重要

共享区应使用固定宽度整数和相对偏移量，明确版本、总长度、槽大小以及字节序。生产者先写负载，再以 release 语义发布可见的写索引；消费者以 acquire 语义读取索引后才访问对应槽。若需要进程共享的 pthread mutex/condition variable，必须设置 `PTHREAD_PROCESS_SHARED`，并考虑持锁进程异常退出时的 robust mutex 策略。

```c
struct shared_header {
    uint32_t magic;
    uint16_t version;
    uint16_t slot_count;
    _Atomic uint32_t write_seq;
    _Atomic uint32_t read_seq;
};
```

头部还应与高频数据分离并按缓存行对齐，避免生产者和消费者反复写同一缓存行。裸指针不能跨进程保存，因为两个进程的映射基址可能不同；使用相对共享区起点的偏移更稳妥。

## 在 Linux 上检查

```bash
ls -lh /dev/shm
findmnt /dev/shm
ls -l /proc/$PID/fd | grep '/dev/shm\|memfd'
grep -E '/dev/shm|memfd' /proc/$PID/maps
```

容量规划要同时考虑 tmpfs 限制、容器 `/dev/shm` 大小、进程地址空间和锁定内存限制。对象名称存在不代表进程仍健康，启动时需要校验 magic、版本和 owner/epoch，而不是盲目复用旧数据。

## 证据边界

本文说明 CPU 进程间共享内存，不覆盖具体 GPU、RDMA 或 DMA-BUF 的同步语义。是否更快必须在相同负载大小、同步策略、NUMA 放置和异常恢复要求下，与 pipe/socket 等方案实测比较。

参考：[shm_overview(7)](https://man7.org/linux/man-pages/man7/shm_overview.7.html) · [mmap(2)](https://man7.org/linux/man-pages/man2/mmap.2.html) · [memfd_create(2)](https://man7.org/linux/man-pages/man2/memfd_create.2.html) · [拆解 Linux 共享内存原理：“零拷贝”通信的核心机制](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494326&idx=1&sn=7fbdac5c9294a6dc76a45bda1ccd9f82)
