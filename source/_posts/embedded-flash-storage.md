---
title: 嵌入式 Flash 存储：擦写约束、掉电安全与磨损均衡
date: 2026-05-04 14:00:00
permalink: /2026/07/29/embedded-flash-storage/
categories: [技术, 嵌入式]
tags: [Flash, EasyFlash, 掉电保护]
---

Flash 不是可以随意覆盖的 RAM。写入前通常需要按扇区擦除，擦除粒度比一条配置大得多，且每个扇区的擦写次数有限。可靠存储要同时处理三件事：掉电时不能丢掉旧值，反复更新时不能把少数扇区磨坏，启动时要能判断哪条记录可信。

<div class="note-flow"><span>生成新配置记录</span><i>→</i><span>写入数据与校验</span><i>→</i><span>原子提交有效标志</span><i>→</i><span>启动时扫描最新版本</span><i>→</i><span>后台回收旧扇区</span></div>

<figure class="note-visual"><figcaption><span>记录图</span>新记录先完整写入，旧记录在确认后才变成可回收空间。</figcaption><div class="note-map"><span><b>记录头</b><small>包含类型、版本、长度和序号，支持启动时排序。</small></span><span><b>payload</b><small>按明确格式保存，避免依赖编译器布局。</small></span><span><b>校验</b><small>确认内容在掉电或存储错误后仍可识别。</small></span><span><b>提交位</b><small>最后写入，表示整条记录已经完整落盘。</small></span><span><b>双区选择</b><small>至少保留一个可用区，避免先擦唯一好数据。</small></span><span><b>垃圾回收</b><small>在安全时机搬迁有效记录，再擦除旧扇区。</small></span></div></figure>

## 写入顺序决定掉电后的结果

一条记录可以按“头部、数据、CRC、提交位”的顺序写入。任何一步掉电，启动扫描都应把它当作未完成记录并继续使用上一条有效值。不要通过先擦除旧扇区来腾空间，也不要在擦除完成前就更新“最新记录”的指针。

若底层 Flash 只能把位从 1 写成 0，提交位还可以设计为单向改变；这一特性让提交比反复覆盖更可靠。具体位布局要按照芯片编程粒度和 ECC 行为验证，不能只在仿真里假设它成立。

## 寿命问题靠分散写入解决

高频计数器、日志和配置不能都压在同一个扇区。追加日志、轮换扇区和按需合并可以把磨损分散出去。记录启动时还应统计坏块、CRC 失败和回收次数；这些数据能帮助区分“程序写错”与“存储开始退化”。

参考：[EasyFlash](https://github.com/armink/EasyFlash)
