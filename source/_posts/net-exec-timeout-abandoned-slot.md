---
title: 提交方超时了，执行方还在跑：一个请求槽的回收竞态
date: 2026-08-09 09:30:00
allow_future: true
permalink: /2026/08/09/net-exec-timeout-abandoned-slot/
categories: [技术, 系统编程]
tags: [并发, 信号量, 超时, C, RISC-V]
---

`net_exec_submit()` 把回调提交给网络线程，并允许提交方等待完成。正常路径很简单，难点在超时：提交方准备返回时，请求可能仍在队列里，也可能已经进入回调。

如果提交方一超时就清空槽位，下一个请求可能立即复用同一份 `proc`、`arg` 和完成信号量，而工作线程仍持有旧请求的指针。这会把一次普通超时变成槽位复用竞态。反过来，如果超时后谁都不回收，固定的八个请求槽很快会耗尽。

<div class="note-flow"><span>提交请求</span><i>→</i><span>等待完成</span><i>→</i><span>超时标记 abandoned</span><i>→</i><span>执行方回收槽位</span></div>

<figure class="note-visual"><figcaption><span>谁拥有回收权</span>工作线程最终确认请求不再使用后，才清空可复用槽位。</figcaption><div class="note-map"><span><b>queued</b><small>队列仍持有请求指针。</small></span><span><b>started</b><small>回调已开始，提交方不能复用槽位。</small></span><span><b>abandoned</b><small>超时后的弃置标记。</small></span><span><b>completed</b><small>回调完成并消费通知。</small></span></div></figure>

## 超时不等于取消

我先确认了当前实现的真实状态，而没有把它美化成一个不存在的枚举状态机。`kernel/src/net/net_exec.c` 使用 `started`、`completed`、`abandoned` 三个布尔字段，`proc == 0` 表示空槽，所有检查和修改由 `request_locker` 串行化。

请求入队后，提交方在槽位的 `done` 信号量上等待。工作线程出队时有两种情况：

```text
尚未 started，提交方已 abandoned
  -> 跳过回调
  -> 工作线程清空 proc

已经 started，提交方等待超时
  -> 提交方不能复用槽位
  -> 等待回调真正结束
```

第一种情况下，队列仍持有请求指针，因此由工作线程回收最安全。第二种情况下，回调没有取消协议。提交方若提前清空槽位，旧回调就可能踩到新请求。

## 为什么不能简单持锁等回调

回调执行时间不可控，不能在 `request_locker` 内运行。工作线程只在切换状态时持锁，设置 `started = 1` 后解锁执行回调，完成后再持锁检查 `abandoned`。

提交方发现 `err < 0 && started && !completed` 时，也会先放锁，再以无限等待模式等完成通知。慢回调即使超过原来的 `timeout_ms`，最终仍返回 `NET_ERR_OK`，因为操作已经开始并完成，系统不能假装取消成功。

## 一个容易遗漏的信号量计数

还有一条更窄的竞态：定时等待刚返回超时，工作线程同时已经设置 `completed` 并通知 `done`。提交方重新拿锁后若直接清空槽位，那次通知会残留到下一次复用，下一位提交者可能立即“完成”。

当前代码在看到 `completed` 后，用非阻塞等待再消费一次 `done` 计数，然后才清空 `proc`。`abandoned` 路径则刻意不通知，保证永久绑定在槽位上的信号量保持为 0。

这里需要澄清一个名称。信号量本身不是每次请求结束后销毁的对象。`net_exec_init()` 为每个静态槽创建一次 `done`，之后请求只重置字段并复用它。因此更准确的问题不是“工作线程 signal 了已经释放的信号量”，而是“旧请求是否会给复用槽位留下陈旧通知，或让工作线程继续访问已改写的请求字段”。

主机测试用两个提交线程和一个工作线程检查回调不重叠，并构造了 10 ms 提交超时、约 30 ms 慢回调的场景。回调已经 started 后，`net_exec_submit()` 最终必须返回成功：

```bash
bash tests/host/test_m6b_exec.sh
```

代码协议与证据路径可在 [Quard 提交 d995e31](https://github.com/Quchaosheng/quard-star-riscv64-net/commit/d995e31335bea05669d3313d6023ff5de413943c) 中复核。

**证据边界：**现有测试覆盖已 started 的慢回调和部分完成竞态，没有穷举所有锁时序，也不是形式化并发证明。主机 pthread 实现与 RISC-V 目标内核信号量也不是同一份实现。
