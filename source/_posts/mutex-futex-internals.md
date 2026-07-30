---
title: mutex 底层：无竞争走原子操作，有竞争才用 futex
date: 2026-07-29 13:29:00
categories: [技术, C-C++]
tags: [mutex, futex, 线程同步]
---

现代互斥锁的快路径通常完全在用户态：用原子 CAS 修改锁状态。只有发现锁已被占用时，才通过 futex 把等待线程挂起；解锁方再按需唤醒。

<div class="note-flow"><span>CAS 尝试获取锁</span><i>→</i><span>成功：进入临界区</span><i>→</i><span>失败：futex 等待</span><i>→</i><span>解锁方唤醒</span><i>→</i><span>重新竞争</span></div>

因此 mutex 在低竞争下很便宜。性能问题往往来自长临界区、频繁跨核修改同一缓存行或锁粒度不合理，而非 mutex 这个抽象本身。

参考：[mutex 底层原理](http://mp.weixin.qq.com/s?__biz=MzkzNDk2NTUwOQ==&mid=2247484167&idx=1&sn=b513916a6bdc7845486b50cc109669be)
