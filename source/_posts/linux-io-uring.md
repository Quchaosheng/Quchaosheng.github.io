---
title: io_uring：用共享环减少异步 I/O 开销
date: 2026-07-29 16:09:18
source_checked_at: 2026-07-29 16:09:18
permalink: /2026/07/29/linux-io-uring/
categories: [技术, Linux内核]
tags: [io_uring, 异步IO, 性能]
description: 拆解 io_uring 的 SQ、CQ、SQE 和 CQE，说明批量提交、固定资源、背压以及实际异步能力的边界。
---

传统的同步 I/O 常把“提交操作”和“等待结果”绑在一次系统调用里；高并发程序若为每个请求建立线程，又会付出调度与栈空间成本。`io_uring` 将提交队列（SQ）和完成队列（CQ）映射到用户态，让应用批量描述请求、批量收割结果。它减少的是进入内核和管理请求的开销，不会让存储设备本身凭空变快。

## 四个对象先分清

- **SQ**：提交环，保存待处理 SQE 的索引。
- **SQE**：提交项，描述操作码、文件、缓冲区、偏移和用户标识。
- **CQ**：完成环，保存内核已经完成的 CQE。
- **CQE**：完成项，`res` 表示结果或负的 errno，`user_data` 用于对应原请求。

<div class="note-flow"><span>应用填写 SQE</span><i>→</i><span>提交到 SQ</span><i>→</i><span>内核执行 I/O</span><i>→</i><span>结果写入 CQE</span><i>→</i><span>应用收割完成事件</span></div>

<div class="note-map"><span><b>SQ head</b><small>内核已经消费到哪里</small></span><span><b>SQ tail</b><small>应用已经发布到哪里</small></span><span><b>SQE</b><small>操作参数与 user_data</small></span><span><b>CQ head</b><small>应用已经收割到哪里</small></span><span><b>CQ tail</b><small>内核已经完成到哪里</small></span><span><b>内存顺序</b><small>发布索引前必须让描述内容可见</small></span></div>

## 最小观察与能力检查

生产代码通常使用 `liburing`，避免手工处理映射、屏障和兼容细节。调试时先确认内核版本和禁用状态，再用 `strace` 观察 setup、register 和 enter 三类系统调用。

```bash
uname -r
cat /proc/sys/kernel/io_uring_disabled 2>/dev/null || true
strace -f -e io_uring_setup,io_uring_register,io_uring_enter ./your_app
```

一个常见事件循环是：准备一批 SQE，调用 `io_uring_submit()`，再用 `io_uring_peek_cqe()` 或 `io_uring_wait_cqe()` 收割完成项。必须检查每个 CQE 的 `res`，处理短读、取消、超时和部分失败；提交成功只表示请求被接受，不表示 I/O 已完成。

## 哪些优化有条件

- **批量提交**减少系统调用次数，但批次过大可能增加单个请求的排队延迟。
- **注册文件和固定缓冲区**减少每次请求的查找、引用与页固定成本，但会占用长期资源，更新和回收也更复杂。
- **SQPOLL**由内核线程轮询 SQ，可减少提交系统调用，但持续消耗 CPU，并受权限和部署环境约束。
- **链接请求与 multishot**能表达更复杂的操作序列，但需要按目标内核和操作码核对语义。
- 某些文件系统或操作可能进入工作线程。接口是异步的，不代表每个操作都由设备原生异步执行。

## 背压不能省略

队列深度有限。应用发布速度超过设备完成速度时，CQ 必须及时收割，SQ 也可能没有空位。可靠实现需要限制在途请求数、定义超时和取消策略，并在关闭前处理仍在飞行的请求。只比较峰值吞吐而不记录 P99 延迟、CPU 使用率和错误率，很容易得到片面的结论。

## 证据边界

本文不假定 `io_uring` 一定优于 `epoll`、线程池或同步 I/O。收益取决于内核版本、文件类型、设备、队列深度和负载模型；应在相同请求大小、并发度与数据耐久语义下比较吞吐、尾延迟和 CPU 成本。

参考：[io_uring_setup(2)](https://man7.org/linux/man-pages/man2/io_uring_setup.2.html) · [liburing](https://github.com/axboe/liburing) · [不懂 io_uring，别再说你懂 Linux 内核了](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494637&idx=1&sn=781ea91aebf0ab18a253192b50904eb7)
