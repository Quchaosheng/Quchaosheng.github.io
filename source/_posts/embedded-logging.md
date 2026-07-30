---
title: 嵌入式日志系统：在可观测性与实时性之间取舍
date: 2026-06-10 14:00:00
permalink: /2026/07/29/embedded-logging/
categories: [技术, 嵌入式]
tags: [日志, EasyLogger, 可观测性]
---

日志要提供等级、模块、时间戳和输出后端，同时避免在中断或实时路径中格式化和阻塞发送。常用方案是快速写入环形缓冲区，再由后台任务输出到串口、Flash 或网络。

<div class="note-flow"><span>业务产生结构化日志</span><i>→</i><span>按等级过滤</span><i>→</i><span>写入内存缓冲区</span><i>→</i><span>后台批量输出</span><i>→</i><span>主机解析与检索</span></div>

参考：[EasyLogger](https://github.com/armink/EasyLogger)
