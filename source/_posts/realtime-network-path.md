---
title: Linux 实时网络路径：从网卡中断到应用线程
date: 2026-07-30 09:28:00
categories: [技术, Linux实时]
tags: [NAPI, IRQ亲和性, 实时网络]
---

数据包到达后要依次经过网卡 IRQ、NAPI 轮询、协议栈、套接字唤醒和应用调度。任何一环的 CPU 迁移、队列拥塞、软中断积压或锁竞争，都会扩大端到端抖动，因此只提高应用线程优先级通常不够。
<div class="note-flow"><span>网卡收到数据包</span><i>→</i><span>IRQ 唤起 NAPI</span><i>→</i><span>协议栈处理并入 socket</span><i>→</i><span>唤醒实时应用</span><i>→</i><span>记录端到端延迟</span></div>

优化应让硬件队列、IRQ、NAPI 与应用尽量保持 CPU/NUMA 局部性，同时控制合并参数和后台流量。每次调整都要以线上业务包长和并发负载复测。参考：[Scaling in the Linux Networking Stack](https://docs.kernel.org/networking/scaling.html)
