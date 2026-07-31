---
title: Linux 周期控制循环入门：绝对唤醒、内存锁定和 deadline miss
date: 2026-02-27 09:30:00
permalink: /2026/02/27/linux-periodic-control-loop-basics/
categories: [技术, Linux实时]
tags: [实时Linux, 控制循环, clock_nanosleep, mlockall, deadline]
---

一个“每 1 ms 执行一次”的线程，如果每次都用 `sleep(1ms)`，运行一段时间后通常会逐渐漂移。它还可能在第一次访问大数组时触发缺页，在日志输出时阻塞，在等待锁时超过周期。要学习实时控制，先写一个能测出这些问题的小循环，比直接上完整机器人更容易。

下面这篇是基础教程：用稳态时钟做绝对唤醒，锁定进程内存，设置线程亲和性和优先级，然后统计 deadline miss。它不替代 PREEMPT_RT，也不等于真机控制器的安全实现。

<div class="note-flow"><span>选择稳态时钟和周期</span><i>→</i><span>绝对时间唤醒</span><i>→</i><span>锁定内存并预热</span><i>→</i><span>运行固定工作量</span><i>→</i><span>统计周期和 deadline miss</span></div>

<figure class="note-visual"><figcaption><span>周期循环图</span>控制循环要把唤醒、计算、输出和下一次 deadline 分开测量。</figcaption><div class="note-map"><span><b>CLOCK_MONOTONIC</b><small>不受墙上时间校正影响，适合测量间隔和截止期。</small></span><span><b>绝对唤醒</b><small>每次按下一个目标时刻睡眠，避免相对 sleep 累积漂移。</small></span><span><b>mlockall</b><small>减少运行期缺页，但不能替代预触页和检查栈增长。</small></span><span><b>固定工作量</b><small>先用可控计算量测试，避免把 I/O 和动态分配混进基线。</small></span><span><b>deadline</b><small>区分迟到、超时和跳过周期，不能只看平均周期。</small></span><span><b>外部干扰</b><small>IRQ、调度、温度和固件事件需要单独记录和复测。</small></span></div></figure>

## 为什么相对 sleep 会漂移

如果循环每次都执行“工作耗时 + sleep(1ms)”，下一次唤醒时间就会把工作耗时累加进去。绝对唤醒则先计算第 `k` 次目标时刻：

```text
next_deadline = start + (k + 1) * period
clock_nanosleep(CLOCK_MONOTONIC, TIMER_ABSTIME, next_deadline)
```

当某一周期迟到时，下一周期仍然参考原来的时间表。这样可以明确看到一次 deadline miss，而不是让整个循环悄悄向后漂。

## 一个最小可运行循环

```c
#define _GNU_SOURCE
#include <errno.h>
#include <math.h>
#include <sched.h>
#include <stdio.h>
#include <sys/mman.h>
#include <time.h>

static long long ns(const struct timespec *t) {
    return (long long)t->tv_sec * 1000000000LL + t->tv_nsec;
}

int main(void) {
    const long long period = 1000000LL; /* 1 ms */
    struct timespec next;
    clock_gettime(CLOCK_MONOTONIC, &next);
    mlockall(MCL_CURRENT | MCL_FUTURE);

    long long misses = 0;
    for (long long k = 0; k < 100000; ++k) {
        next.tv_nsec += (long)(period % 1000000000LL);
        next.tv_sec += period / 1000000000LL;
        if (next.tv_nsec >= 1000000000L) {
            next.tv_nsec -= 1000000000L;
            next.tv_sec++;
        }

        /* 这里放固定工作量，不做文件 I/O 或 malloc。 */
        volatile double x = 0.0;
        for (int i = 0; i < 100; ++i) x += sin((double)i);

        struct timespec now;
        clock_gettime(CLOCK_MONOTONIC, &now);
        if (ns(&now) > ns(&next)) misses++;
        while (clock_nanosleep(CLOCK_MONOTONIC, TIMER_ABSTIME, &next, NULL) == EINTR) {}
    }
    printf("deadline_miss=%lld\n", misses);
    return 0;
}
```

编译：

```bash
gcc -O2 -Wall -Wextra loop.c -o loop -lm
./loop
```

这是学习用基线。它没有检查 `mlockall` 是否成功，没有设置实时调度，也没有连接执行器。真实程序要处理权限、信号、异常退出和输出链路。

## 内存锁定不是魔法开关

`mlockall(MCL_CURRENT | MCL_FUTURE)` 可以减少运行期换页，但锁定内存需要权限和 `RLIMIT_MEMLOCK` 配置。堆、栈、线程栈和共享库的访问仍应在启动阶段预热。动态增长、文件映射、设备 DMA 和内核回收路径可能引入别的等待。

可以先查看限制：

```bash
ulimit -l
grep -E 'VmLck|VmRSS|Threads' /proc/<PID>/status
```

如果 `mlockall` 失败却继续把结果当实时基线，报告应该明确标记失败原因。

## 再加调度和绑核

周期循环可以配合 `pthread_setschedparam` 和线程 affinity，但顺序要慎重：先让循环可运行、可测量，再逐步加入调度策略、绑核、IRQ 隔离和内存预触碰。任何一步都要保存前后的延迟直方图。

线程级 affinity 的代码、`taskset` 和 IRQ 检查方法见[Linux 线程绑核](/2026/02/06/linux-thread-cpu-affinity/)。如果周期循环运行在 ROS 2 节点里，还要把内核唤醒和[Executor 回调等待](/2026/02/17/ros2-executor-callback-groups-basics/)分开记时间。

`SCHED_FIFO` 线程如果不阻塞、不让出 CPU，可能压住普通任务；实时运行时预算、看门狗和退出路径必须先设计好。不要把提高优先级当作修复周期超时的唯一手段。

## 用 deadline miss 说清楚结果

至少记录周期、唤醒延迟、工作时间、输出时间和 deadline miss 次数。再用 `cyclictest` 或 `rtla timerlat` 对照系统基线，区分应用自己的问题和内核/固件干扰。测试时固定 CPU、功耗模式、负载、运行时长和温度条件。

## 参考资料

- [clock_nanosleep(2)](https://man7.org/linux/man-pages/man2/clock_nanosleep.2.html)
- [mlockall(2)](https://man7.org/linux/man-pages/man2/mlockall.2.html)
- [Linux rt-mutex documentation](https://docs.kernel.org/locking/rt-mutex.html)
- [PREEMPT_RT documentation](https://docs.kernel.org/locking/locktypes.html)
- [rtla timerlat](https://docs.kernel.org/tools/rtla/rtla-timerlat.html)

**证据边界：**示例只用于学习周期唤醒、内存锁定和 deadline 统计，不代表控制器具备实时或安全认证。具体延迟取决于内核、硬件、IRQ、功耗和负载；发布前应在目标平台上做完整证据包。
