---
title: Linux 线程如何绑核：taskset、pthread affinity 与 cpuset
date: 2026-02-06 09:30:00
permalink: /2026/02/06/linux-thread-cpu-affinity/
categories: [技术, Linux实时]
tags: [线程, CPU亲和性, taskset, pthread, cpuset]
---

控制线程偶尔跑到另一颗 CPU 后，延迟突然多出一截。先别急着把 `isolcpus` 加进内核启动参数。Linux 里至少有三件事容易混在一起：进程的 CPU 亲和性、某个线程的亲和性，以及中断和内核后台工作的落点。只绑住其中一个，其他工作仍然可能在同一颗 CPU 上打断它。

这篇先把“用户线程绑核”讲完整，再说明怎样验证绑核真的生效。代码和命令都可以在普通 Linux 主机上练习，实时控制的结论仍需要目标内核和负载下的测量。

<div class="note-flow"><span>确认进程和线程 ID</span><i>→</i><span>读取当前 CPU 亲和性</span><i>→</i><span>设置线程级 affinity</span><i>→</i><span>检查 IRQ、cgroup 和 NUMA</span><i>→</i><span>在同一负载下比较延迟</span></div>

<figure class="note-visual"><figcaption><span>绑核关系图</span>线程只决定自己允许在哪些 CPU 上运行，不能替其他任务清空这颗 CPU。</figcaption><div class="note-map"><span><b>PID</b><small>进程 ID 是资源容器，进程内可以有多个独立调度的线程。</small></span><span><b>TID</b><small>线程 ID 才是调度器实际运行和设置 affinity 的对象。</small></span><span><b>CPU mask</b><small>允许集合不是“当前所在 CPU”，线程仍会在集合内迁移。</small></span><span><b>IRQ</b><small>设备中断落在同一 CPU 时，用户线程仍会被打断。</small></span><span><b>cpuset</b><small>cgroup 可以限制一组任务可用的 CPU，比单个进程更适合部署约束。</small></span><span><b>NUMA 内存</b><small>线程绑到远端 CPU 后，数据页的位置也会影响访问延迟。</small></span></div></figure>

## 先分清 PID、TID 和当前 CPU

`ps` 显示一个进程时，默认只给出进程级信息。真正执行控制循环的是线程。可以先列出线程和它最近运行过的 CPU：

```bash
ps -eLo pid,tid,psr,cls,rtprio,pri,comm --sort=tid
taskset -pc <PID>
grep -E '^(Cpus_allowed_list|Mems_allowed_list):' /proc/<PID>/status
```

`psr` 是最近一次运行的 CPU，不是允许集合。`taskset -pc` 读到的是进程的 affinity mask；如果进程已经创建了多个线程，后续仍应逐个检查 `/proc/<PID>/task/<TID>/status`。

## 用 taskset 做第一次实验

对一个已经运行的进程，可以先把它限制到 CPU 2 和 3：

```bash
taskset -cp 2,3 <PID>
taskset -pc <PID>
```

这条命令修改的是进程里已有线程的允许集合。新线程是否继承该集合、程序是否随后自己修改，都要实际确认。权限不足时，普通用户只能调整自己拥有的任务；跨用户或实时优先级操作可能需要相应的权限和 cgroup 配置。

绑核不是把线程“钉死”在一颗 CPU 上。`2,3` 代表它仍可在两颗 CPU 之间迁移。若要减少迁移，可以指定单个 CPU，但这会把该 CPU 的算力和中断余量一起压缩，必须看负载而不是只看延迟最好的一次结果。

## 代码里设置单个线程

Linux 提供 `pthread_setaffinity_np()` 设置指定线程的 CPU 集合。下面的例子创建一个工作线程，把它限制在 CPU 2，然后打印线程看到的集合：

```c
#define _GNU_SOURCE
#include <pthread.h>
#include <sched.h>
#include <stdio.h>
#include <unistd.h>

static void *worker(void *arg) {
    cpu_set_t set;
    CPU_ZERO(&set);
    CPU_SET(2, &set);

    int rc = pthread_setaffinity_np(pthread_self(), sizeof(set), &set);
    if (rc != 0) {
        fprintf(stderr, "pthread_setaffinity_np failed: %d\n", rc);
        return NULL;
    }

    CPU_ZERO(&set);
    pthread_getaffinity_np(pthread_self(), sizeof(set), &set);
    printf("allowed cpu 2: %s\n", CPU_ISSET(2, &set) ? "yes" : "no");
    for (;;) pause();
}

int main(void) {
    pthread_t thread;
    pthread_create(&thread, NULL, worker, NULL);
    pthread_join(thread, NULL);
    return 0;
}
```

编译和运行：

```bash
gcc -O2 -Wall -Wextra -pthread affinity_demo.c -o affinity_demo
./affinity_demo
```

生产代码还要处理 CPU 编号不存在、容器 cpuset 不允许 CPU 2、线程创建失败和退出顺序。`pthread_setaffinity_np` 的 `np` 表示它不是 POSIX 可移植接口，跨平台程序应把这段能力包在平台适配层里。

## 为什么绑核后延迟仍然会抖

线程 affinity 只限制调度范围。网卡 IRQ、线程化中断、softirq、workqueue、日志线程和同一 cgroup 的其他任务仍可能使用这颗 CPU。可以对照查看：

```bash
cat /proc/interrupts
grep -R . /proc/irq/*/smp_affinity_list 2>/dev/null | head
cat /sys/fs/cgroup/cpuset.cpus.effective 2>/dev/null
```

如果控制线程固定在 CPU 2，而网卡多队列也集中到 CPU 2，绑核只会让冲突更稳定。实时部署通常需要一起规划 housekeeping CPU、IRQ affinity、线程 affinity 和 cgroup，而不是单独执行一条 `taskset`。

## NUMA 机器还要看内存在哪

双路或多 NUMA 节点机器上，线程跑在哪个 CPU 和数据页落在哪个节点是两回事。线程启动时在 CPU 0 上分配并触碰大缓冲区，后面迁到另一个节点后，访问可能变成跨节点。可以先查看 CPU 和内存节点：

```bash
lscpu -e=CPU,NODE,ONLINE
numactl --hardware
numastat -p <PID>
```

绑核、内存预触碰和 NUMA policy 应作为一个实验变量组处理。单独看到 cache miss 增加，不能马上断言是调度迁移造成的。

## 验证要看迁移和尾延迟

绑核前后使用同一负载、同一运行时长和同一测量工具。记录线程实际运行 CPU、迁移次数、IRQ 活跃度、P95/P99 延迟和 deadline miss。只看 `top` 里的平均 CPU 使用率，看不出一个 200 微秒的尾部尖峰。

一个合格的结论应写清楚：线程允许哪些 CPU、哪些 IRQ 在这些 CPU 上、内存策略是什么、测试负载是什么，以及测量没有覆盖哪些固件或硬件干扰。

需要把 `PID`、`TID` 和 `/proc/<PID>/task` 再拆开时，可以看[Linux 进程、线程与 task](/2026/03/19/linux-process-thread-task-basics/)；绑核前后的延迟比较则适合放进[绝对唤醒周期循环](/2026/02/27/linux-periodic-control-loop-basics/)里，避免用普通业务负载得到一组无法复现的数字。

## 参考资料

- [sched_setaffinity(2)](https://man7.org/linux/man-pages/man2/sched_setaffinity.2.html)
- [pthread_setaffinity_np(3)](https://man7.org/linux/man-pages/man3/pthread_setaffinity_np.3.html)
- [Linux CPU isolation](https://docs.kernel.org/admin-guide/kernel-parameters.html)
- [Linux IRQ affinity](https://docs.kernel.org/core-api/irq/irq-affinity.html)
- [Linux cpuset controller](https://docs.kernel.org/admin-guide/cgroup-v1/cpusets.html)

**证据边界：**示例只证明如何设置和检查用户线程的 CPU 允许集合，不代表绑核后一定得到更低延迟。IRQ、cgroup、NUMA、固件和热管理都可能改变结果；发布前应在目标内核、设备和负载上复测。
