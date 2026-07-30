---
title: 实时任务的内存锁定：避免缺页与回收抖动
date: 2026-07-30 09:06:00
categories: [技术, Linux实时]
tags: [mlockall, 缺页, 实时内存]
---

实时线程最怕的不是“内存不够快”，而是关键路径第一次碰到一页尚未真正就绪的内存。一次缺页可能触发页表遍历、物理页分配、零页填充、文件页读取，极端情况下还会进入回收或写回；写时复制、首次增长的线程栈和运行中 `malloc` 也会带来类似的不可预测工作。它们在平均性能测试中很少出现，却足以制造一次很长的延迟尖峰。

<div class="note-flow"><span>启动时分配全部缓冲区</span><i>→</i><span>mlockall 锁定映射</span><i>→</i><span>逐页预触碰内存</span><i>→</i><span>进入实时循环</span><i>→</i><span>循环内不分配、不缺页</span></div>

## 关键路径里到底要避免什么

把内存问题拆开会更清楚：虚拟地址空间存在，不代表对应的物理页已经分配；物理页已经分配，也不代表它不会被换出；堆缓冲区已锁定，也不代表后来创建的线程栈或动态库页已预热。实时设计要同时控制这些层次。

<div class="note-map"><span><b>缺页</b><small>首次访问映射时可能分配页、读盘或更新页表</small></span><span><b>写时复制</b><small>fork 后第一次写共享页会复制，实时路径应避免</small></span><span><b>动态分配</b><small>malloc/free 可能取锁、扩堆或触发回收</small></span><span><b>线程栈</b><small>深调用或首次触碰新栈页也会造成缺页</small></span><span><b>换页与回收</b><small>内存压力下可能让正常路径突然变成长路径</small></span><span><b>解决思路</b><small>固定容量、预分配、锁定、预触碰、运行时零分配</small></span></div>

`mlockall(MCL_CURRENT | MCL_FUTURE)` 会请求锁住当前映射和之后创建的映射，使这些页面不被换出；但它不替你访问每一页。启动阶段仍应逐页写入计划使用的堆、环形缓冲区和自定义线程栈，让物理页与页表都提前建立。

```c
#include <sys/mman.h>
#include <unistd.h>

static void prefault(void *buffer, size_t bytes) {
    const long page = sysconf(_SC_PAGESIZE);
    volatile unsigned char *p = buffer;
    for (size_t off = 0; off < bytes; off += (size_t)page) p[off] = 0;
}

/* 启动阶段：分配固定缓冲区 -> 锁定 -> 预触碰 -> 再启动实时线程 */
if (mlockall(MCL_CURRENT | MCL_FUTURE) != 0) {
    /* 记录错误并拒绝进入实时模式 */
}
prefault(ring_buffer, ring_buffer_bytes);
```

示例只展示核心顺序。实际工程还应检查 `mlockall` 返回值、锁定上限、线程栈大小和运行期是否有库偷偷分配内存。

## 权限、上限与副作用

可锁定内存受 `RLIMIT_MEMLOCK` 限制，服务进程还可能受 systemd、容器 cgroup 或能力集约束。申请失败时绝不能悄悄继续跑“实时模式”；应在日志中打印限制值并明确降级。锁得过多会使系统失去可回收页面，反而让其他关键服务更容易 OOM 或抖动。

一个可控的策略是只锁定实时工作集：固定容量的 I/O 缓冲、状态快照、实时线程栈和必要的模型/查表数据，而不锁大量文件缓存或后台任务内存。实时循环内采用对象池、环形队列或预分配容器，日志写入也改为无阻塞缓冲后由后台线程落盘。

## 如何验证这项优化真的有效

不要只看 `mlockall` 返回成功。先在未锁定版本中用 `perf`、ftrace 或缺页统计找到首次运行与内存压力下的尖峰，再在相同压力下比较。还要测试线程创建、配置热更新、首次收到大包、模型切换和异常恢复，因为这些常常把新的分配悄悄带回关键路径。

实时内存的目标不是“永远不触碰内核”，而是让关键周期中每一次可能变长的内存操作都提前发生、可测量或被明确拒绝。

参考：[mlock(2)](https://man7.org/linux/man-pages/man2/mlock.2.html) · [memlock resource limit](https://man7.org/linux/man-pages/man2/getrlimit.2.html)
