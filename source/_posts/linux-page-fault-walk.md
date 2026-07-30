---
title: 缺页异常与页表遍历：一次内存访问的补救过程
date: 2026-07-29 16:09:18
source_checked_at: 2026-07-29 16:09:18
permalink: /2026/07/29/linux-page-fault-walk/
categories: [技术, Linux内核]
tags: [缺页异常, 页表, 虚拟内存]
description: 区分 TLB miss、minor/major fault、COW 与非法访问，并给出 Linux 上观察缺页行为的可靠方法。
---

缺页异常（page fault）不等于程序出错。MMU 无法按当前页表完成访问时，CPU 把控制权交给内核；内核可能分配匿名页、从文件页缓存建立映射、执行 COW，也可能判定地址或权限非法并发送信号。按需分页正是利用可修复的 fault，避免程序启动时为尚未访问的区域立即准备全部物理页。

## 先区分 TLB miss

TLB miss 通常由硬件页表遍历解决，不一定进入内核；page fault 则表示遍历结果无法满足这次访问，例如页表项尚未建立、页面不在内存、写入只读 COW 映射或权限检查失败。把 perf 中的 TLB miss 数直接当成缺页次数，会混淆两个不同层次。

<div class="note-flow"><span>内存访问无法完成</span><i>→</i><span>CPU 进入异常入口</span><i>→</i><span>内核查找 VMA</span><i>→</i><span>验证地址与权限</span><i>→</i><span>补页、COW 或发送信号</span></div>

<div class="note-map"><span><b>VMA</b><small>描述地址区间的合法用途与权限</small></span><span><b>页表项</b><small>记录具体页面映射和硬件状态</small></span><span><b>匿名页</b><small>首次触碰时分配，常先映射共享零页</small></span><span><b>文件映射</b><small>可能从 page cache 或存储取得页面</small></span><span><b>COW</b><small>私有写入时建立新的可写页面</small></span><span><b>信号</b><small>无法修复时通常产生 SIGSEGV/SIGBUS</small></span></div>

## minor 与 major 的含义

minor fault 不需要为页面发起存储 I/O，例如匿名页首次分配、已有 page cache 的文件页建立 PTE、或某些 COW 情况。major fault 通常意味着需要等待后备存储读入页面。二者都是进程记账分类，不直接等于“快”和“慢”的固定时间；NUMA、内存回收、锁竞争和存储设备都会改变代价。

## 用同一工作负载观察

```bash
/usr/bin/time -v ./your_app 2>&1 | grep -E 'Major|Minor'
perf stat -e page-faults,minor-faults,major-faults -- ./your_app

pid=1234
awk '{print "minflt=" $10, "majflt=" $12}' /proc/$pid/stat
```

`/proc/<pid>/stat` 的字段位置固定但命令名可能包含空格和括号，生产脚本不宜用上面这种简单 awk 解析；更可靠的采集程序应按 proc 文档处理完整格式。对延迟敏感任务，还应记录 fault 发生的阶段和调用栈，而不只看进程退出后的累计次数。

## 从 fault 类型回到根因

- 启动阶段 minor fault 很多，可能只是按需建立匿名页或装入共享库，不必立即优化。
- 稳态控制循环仍发生 fault，需要检查是否预触页、是否动态扩展堆栈、映射是否被回收，以及是否错误依赖按需分配。
- major fault 增长要检查文件访问、内存压力、page cache 与 swap，而不是只调高线程优先级。
- `SIGSEGV` 可能来自地址不存在或权限不符；`SIGBUS` 还可能与截断后的文件映射等对象错误相关。

## 证据边界

累计 fault 计数不能定位具体源代码，也不能单独证明内存不足。严谨分析应保存内核版本、映射、内存压力、page cache/swap 状态，并使用 perf/ftrace/eBPF 等工具关联 fault 与调用路径。

参考：[Page tables](https://docs.kernel.org/mm/page_tables.html) · [proc_pid_stat(5)](https://man7.org/linux/man-pages/man5/proc_pid_stat.5.html) · [getrusage(2)](https://man7.org/linux/man-pages/man2/getrusage.2.html) · [不懂缺页异常与页表遍历，别再说你懂 Linux 内核了](http://mp.weixin.qq.com/s?__biz=Mzg4NDQ0OTI4Ng==&mid=2247494630&idx=1&sn=a62e73e92a27290032f4c1c7f8887b3a)
