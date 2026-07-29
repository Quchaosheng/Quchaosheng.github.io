---
title: 互斥锁与自旋锁：等待时该睡眠还是忙等
date: 2026-07-29 13:30:00
categories: [技术, 并发]
tags: [互斥锁, 自旋锁, 性能]
---

自旋锁抢不到锁时持续轮询，占用 CPU 换取极低唤醒延迟；互斥锁通常让线程睡眠，节省 CPU 但包含调度和唤醒成本。

<div class="note-flow"><span>尝试获取锁</span><i>→</i><span>短临界区且不可睡眠</span><i>→</i><span>自旋等待</span><i>→</i><span>否则阻塞等待</span><i>→</i><span>被唤醒后重试</span></div>

自旋锁适合内核中断上下文或极短、确定的临界区；单核、持锁线程可能被抢占、I/O 或长计算临界区都不适合自旋。用户态一般优先 mutex，除非测量证明忙等收益明显。

参考：[互斥锁 vs 自旋锁](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247485071&idx=1&sn=ec95d6d1b48bdc6b99e3855eba63d97)
