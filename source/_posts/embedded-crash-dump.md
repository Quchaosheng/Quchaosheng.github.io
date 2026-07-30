---
title: 嵌入式崩溃转储：复位后仍能还原现场
date: 2026-06-05 14:00:00
permalink: /2026/07/29/embedded-crash-dump/
categories: [技术, 嵌入式]
tags: [CrashDump, 故障诊断, Flash]
---

设备现场复位后，最有价值的信息通常已经消失了。崩溃转储的作用是在异常或看门狗复位时保住一份足够小、却能还原问题的现场：复位原因、寄存器、少量栈、任务身份、固件版本和最近事件。下一次正常启动后再上传或符号化，而不是指望故障时串口一定还能工作。

<div class="note-flow"><span>异常/看门狗触发</span><i>→</i><span>冻结最小现场</span><i>→</i><span>写入带 CRC 的转储槽</span><i>→</i><span>系统复位</span><i>→</i><span>启动后读取、上传并符号化</span></div>

<figure class="note-visual"><figcaption><span>转储内容</span>优先保存能回答“哪版固件、在哪个线程、为什么复位”的字段。</figcaption><div class="note-map"><span><b>复位来源</b><small>区分看门狗、低压、软件复位和异常路径。</small></span><span><b>寄存器帧</b><small>保存 PC、LR、SP 和故障状态，供地址还原。</small></span><span><b>任务信息</b><small>记录线程名、优先级或当前状态，缩小并发问题范围。</small></span><span><b>栈片段</b><small>长度固定，避免一次故障转储占满存储。</small></span><span><b>固件标识</b><small>哈希、版本和构建号必须能找到对应符号文件。</small></span><span><b>CRC 与提交位</b><small>启动时只解析完整写入的转储，防止误报。</small></span></div></figure>

## 故障路径只能做确定的事

异常处理器不应等待互斥锁、申请内存、格式化长字符串或访问复杂驱动。这些组件可能正是故障的一部分。预先分配一个固定大小的保留 RAM 区或 Flash 槽，把固定字段按二进制写入、计算校验并提交即可；复杂的 JSON、网络上传和符号解析放到下次启动后的普通任务里。

如果需要写 Flash，要考虑擦除时间和掉电窗口。保留 RAM 可以在快速复位后保存现场，Flash 更适合跨断电保存。两者也可配合：故障时先写 RAM，启动后的恢复任务再把有效转储移入持久槽。

## 把转储当作一份有版本的协议

转储结构会随着固件演进。为它设置 magic、版本、长度和 CRC，并在解析工具中保留旧版本兼容路径。一次转储只有配套的 ELF 和链接地址才有意义，因此产物归档和构建标识是调试链路的一部分，不是发布后的附加工作。

参考：[CmBacktrace](https://github.com/armink/CmBacktrace)
