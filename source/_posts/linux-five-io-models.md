---
title: Linux 五种 I/O 模型：阻塞、非阻塞与多路复用
date: 2026-07-29 13:27:00
categories: [技术, Linux网络]
tags: [I/O模型, epoll, 网络编程]
---

讨论 I/O 模型时最容易混淆两件事：**数据何时就绪**，以及**数据由谁搬运到应用缓冲区**。阻塞、非阻塞、I/O 多路复用、信号驱动和异步 I/O 的主要差别就在这里。API 名称不决定模型，例如 `read()` 既可能阻塞，也可能在 nonblocking fd 上立即返回 `EAGAIN`；epoll 解决的是“很多 fd 谁就绪了”，并不自动完成读写。

<div class="note-flow"><span>应用发起读请求</span><i>→</i><span>内核等待数据就绪</span><i>→</i><span>通知或唤醒应用</span><i>→</i><span>复制数据并返回</span></div>

## 五种模型的真正区别

阻塞 I/O：调用线程等待数据就绪并完成复制，代码最直接。非阻塞 I/O：调用立即返回，应用需要反复尝试或结合其他通知机制。I/O 多路复用：一个线程用 select/poll/epoll 等待多个 fd 就绪，随后仍由应用调用 `read/recv` 搬运数据。信号驱动 I/O：内核以信号通知 fd 状态变化，适用场景较少且信号处理复杂。异步 I/O：应用提交操作后继续执行，内核在操作完成时报告结果，完成通知与就绪通知不同。

<div class="note-map"><span><b>阻塞 I/O</b><small>线程等待到数据可读并完成 copy；简单，线程数多时成本高</small></span><span><b>非阻塞 I/O</b><small>立即返回；需要处理 EAGAIN 和重试，不能靠忙轮询浪费 CPU</small></span><span><b>多路复用</b><small>集中等待多个 fd 的就绪，再由应用执行实际读写</small></span><span><b>信号驱动</b><small>用信号通知状态，控制流复杂且易与其他信号交织</small></span><span><b>异步 I/O</b><small>提交后由内核完成操作，再以 completion 报告结果</small></span><span><b>io_uring</b><small>现代 Linux 的提交/完成队列接口，需单独理解其语义与资源管理</small></span></div>

## 就绪通知不等于完成通知

epoll 告诉你 socket “现在可能可读/可写”，此时应用还要调用 `recv/send`，并可能遇到部分读写或 `EAGAIN`。异步 I/O 则是操作完成后报告字节数和错误码，应用通常不再为这次请求调用 `read`。混淆两者会导致错误的线程模型和资源生命周期。

```text
epoll:   wait for readiness -> recv/send -> handle partial result
async:   submit operation    -> do other work -> consume completion
```

对于普通网络服务，nonblocking socket + epoll/Reactor 是成熟选择；对于高并发磁盘/网络 I/O，`io_uring` 可能减少系统调用与上下文切换，但它也引入提交队列、完成队列、buffer 注册和取消语义，不能只因为“更快”就替换。

## 如何按工作负载选模型

低并发、简单工具和每连接工作量较大的服务可使用阻塞 I/O + 线程池；连接多且大部分空闲的网络服务器通常选择 epoll；需要将 I/O 与 CPU 密集计算隔离时，使用有界队列和线程池；对极低延迟或高吞吐路径，先测清系统调用、copy、缓存与队列成本后再评估 io_uring 或专用框架。

无论模型如何，必须定义背压、超时、取消和资源释放。I/O 模型解决的是等待与通知方式，不替你决定慢客户端、过期数据和关闭连接应该怎样处理。

参考：[The Linux Programming Interface: I/O models](https://man7.org/tlpi/) · [io_uring](https://docs.kernel.org/io_uring/index.html)
