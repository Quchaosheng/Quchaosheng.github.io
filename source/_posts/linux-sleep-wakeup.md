---
title: 进程睡眠与唤醒：等待队列避免忙等
date: 2026-07-29 13:40:00
categories: [技术, Linux内核]
tags: [等待队列, 睡眠, 唤醒]
---

当驱动等待数据、缓冲区空间、DMA 完成或硬件状态变化时，持续轮询会浪费 CPU，也会让功耗和实时性更差。Linux 用等待队列把“条件暂时不满足”的任务挂起来，设置为可中断或不可中断睡眠；事件发生后，生产者唤醒等待者，调度器再在合适时机让它继续执行。关键点不是调用一次 `wake_up()`，而是正确处理检查条件与进入睡眠之间的竞争。

<div class="note-flow"><span>检查条件不满足</span><i>→</i><span>加入等待队列</span><i>→</i><span>设置任务睡眠</span><i>→</i><span>事件发生并 wake_up</span><i>→</i><span>重新检查条件</span></div>

## 为什么被唤醒后还要再检查条件

唤醒只是“值得再试一次”的通知，不是资源已经独占属于你的承诺。多个消费者可能同时被唤醒、生产者可能在你真正运行前再次改变状态、信号也可能打断可中断睡眠。因此等待者必须在循环里检查条件，只有条件成立才继续处理。

<div class="note-map"><span><b>条件</b><small>真正决定能否继续的状态，例如 ring 非空或 DMA 完成</small></span><span><b>等待队列</b><small>保存暂时睡眠的任务，让生产者能找到合适等待者</small></span><span><b>可中断睡眠</b><small>可被信号打断，适合用户请求等可取消操作</small></span><span><b>不可中断睡眠</b><small>不响应普通信号，需谨慎，避免无法终止的任务</small></span><span><b>唤醒</b><small>通知等待者重新竞争；不等于条件永久成立</small></span><span><b>内存序</b><small>状态更新与唤醒顺序必须让等待者看到正确数据</small></span></div>

内核提供 `wait_event()`、`wait_event_interruptible()` 等宏，将“登记等待者、检查条件、设置状态、睡眠、再次检查”组合成经过验证的模式。手工拆开这些步骤很容易在“检查失败”与“真正睡眠”之间丢失一次唤醒。

```c
/* 消费者：条件在每次被唤醒后都要重新判断 */
ret = wait_event_interruptible(dev->readq,
                               data_available(dev) || device_dead(dev));
if (ret) return ret;              /* 被信号中断 */
if (device_dead(dev)) return -ENODEV;
consume_data(dev);
```

生产者在更新 `data_available` 相关状态后再调用对应 `wake_up*()`。若状态跨 CPU 更新，还要用正确的锁或内存屏障保证等待者不会醒来却读到旧数据。

## 选择哪种睡眠语义

面向用户态的 `read()`、`poll()` 和长操作通常应可中断或可取消，让进程退出、关闭 fd、超时与信号有明确语义。设备故障、热拔插和卸载路径必须唤醒所有相关等待者，并让条件包含“设备已失效”，否则线程可能永远睡在一个再也不会产生事件的队列上。

实时系统还应给等待加 deadline：硬件没有在预算内完成时，不应无限等待再导致控制链路使用过期状态。等待队列是避免忙等的基础，但正确的超时、取消和错误状态才让它成为可靠的工程接口。

参考：[Wait queues and wake events](https://docs.kernel.org/driver-api/basics.html#wait-queues-and-wake-events) · [completion](https://docs.kernel.org/scheduler/completion.html)
