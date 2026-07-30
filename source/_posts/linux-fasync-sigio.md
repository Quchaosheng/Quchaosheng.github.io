---
title: fasync 与 SIGIO：Linux 信号驱动异步通知
date: 2026-07-29 16:09:18
source_checked_at: 2026-07-29 16:09:18
permalink: /2026/07/29/linux-fasync-sigio/
categories: [技术, 嵌入式Linux]
tags: [fasync, SIGIO, 字符设备]
description: 从用户态订阅、驱动 fasync 队列和信号处理限制出发，说明 SIGIO 适用在哪里，以及怎样避免丢事件和生命周期错误。
---

字符设备准备好了数据，应用又不想一直阻塞在 `read()` 上，可以让驱动主动发一条通知吗？`fasync` 与 `SIGIO` 就是 Linux 提供的一条老而直接的路径。它传递的是“文件描述符状态可能变化了”，不是数据本身。应用收到信号后，仍要回到正常的 `read()` 或 `write()` 路径确认状态。

这种方式适合低频、简单的设备事件，例如按键、少量传感器数据或实验性字符驱动。连接多、事件密集或需要精确排队时，`poll/epoll`、`eventfd` 或专用消息队列通常更容易控制。

## 订阅是怎样建立的

用户空间先用 `F_SETOWN` 指定由谁接收 I/O 信号，再通过 `F_SETFL` 打开 `O_ASYNC`。VFS 随后调用驱动 `file_operations.fasync` 回调。驱动一般把工作交给 `fasync_helper()`，由它维护与该文件关联的 `struct fasync_struct` 订阅链。

<div class="note-flow"><span>应用设置 F_SETOWN</span><i>→</i><span>启用 O_ASYNC</span><i>→</i><span>VFS 调用驱动 fasync</span><i>→</i><span>设备产生事件</span><i>→</i><span>kill_fasync 发送 SIGIO</span><i>→</i><span>应用重新读取到 EAGAIN</span></div>

<div class="note-map"><span><b>F_SETOWN</b><small>指定接收 SIGIO 的进程或进程组</small></span><span><b>O_ASYNC</b><small>打开或关闭当前文件描述符的异步通知</small></span><span><b>fasync_helper</b><small>把打开的 file 加入或移出驱动订阅链</small></span><span><b>kill_fasync</b><small>事件到来时向订阅者发送指定信号与 band</small></span><span><b>信号处理器</b><small>只做最小通知，不能承担完整 I/O 处理</small></span><span><b>read/poll</b><small>真正确认数据是否存在，并处理竞争与批量消费</small></span></div>

驱动侧的骨架并不长，难点在对象生命周期和并发：

```c
static struct fasync_struct *async_queue;

static int demo_fasync(int fd, struct file *filp, int on)
{
    return fasync_helper(fd, filp, on, &async_queue);
}

static int demo_release(struct inode *inode, struct file *filp)
{
    demo_fasync(-1, filp, 0);
    return 0;
}

static irqreturn_t demo_irq(int irq, void *data)
{
    /* 先更新受锁保护的设备状态，再通知用户空间。 */
    kill_fasync(&async_queue, SIGIO, POLL_IN);
    return IRQ_HANDLED;
}
```

关闭文件时必须把订阅者移出队列。设备解绑、错误恢复和模块卸载也要先阻止新事件，再同步仍在运行的中断或工作项，最后释放队列依赖的对象。否则 `kill_fasync()` 可能碰到已经失效的状态。

## 用户空间不要在信号里读完所有数据

信号处理函数只能调用异步信号安全函数。更稳妥的做法是让处理器只设置 `sig_atomic_t` 标志，或向 self-pipe 写一个字节，再在主循环里读取设备直到 `EAGAIN`。

```c
static volatile sig_atomic_t io_ready;

static void on_sigio(int signo)
{
    io_ready = 1;
}

/* 初始化时安装 sigaction，设置 F_SETOWN，再打开 O_NONBLOCK | O_ASYNC。 */
if (io_ready) {
    io_ready = 0;
    while (read(fd, buf, sizeof(buf)) > 0)
        consume(buf);
}
```

标准信号通常不会为每次设备事件各保存一个排队实例。两个事件在应用处理前连续到来，可能只观察到一次 `SIGIO`。所以正确语义应是“有工作可做”，收到通知后把当前可读数据排空，而不是把信号次数当成事件数。

## 容易踩的坑

- 先发信号、后写入设备缓冲区，应用醒来却读不到数据。
- 在处理器里调用 `printf`、分配内存或取得普通互斥锁。
- 把 `SIGIO` 次数当作无损计数，忽略信号合并。
- 只实现 `fasync`，却没有让 `read()`、`poll()` 和非阻塞语义保持一致。
- 多个打开者共享一条设备队列，却没有明确每个文件实例是否都应收到通知。

## 证据边界

本文描述字符设备常见实现，不保证每种文件类型都支持 `O_ASYNC`。信号投递时机、所有者语义和可用 band 还受具体驱动与内核版本影响。要验证“没有丢数据”，应给设备事件编号并比较生产与消费序列，不能只统计收到多少次 `SIGIO`。

参考：[fcntl(2)](https://man7.org/linux/man-pages/man2/fcntl.2.html) · [signal-safety(7)](https://man7.org/linux/man-pages/man7/signal-safety.7.html) · [Linux Driver Basics](https://docs.kernel.org/driver-api/basics.html) · [吃透内核 fasync 机制，弄懂信号驱动异步通知](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494999&idx=1&sn=998f50d0caeb7080afac1ac8ee0782fd)
