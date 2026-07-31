---
title: Linux 进程与线程入门：PID、TID、task 和共享资源
date: 2026-03-19 09:30:00
permalink: /2026/03/19/linux-process-thread-task-basics/
categories: [技术, Linux内核]
tags: [进程, 线程, task, PID, TID, 调度]
---

程序明明只有一个 PID，`top -H` 却显示十几个可调度对象；给进程发信号和给线程发信号，结果也可能不同。后面要学绑核、优先级和实时调度，必须先把进程、线程和 Linux 内核里的 `task` 分清。

进程更像资源容器，里面有地址空间、文件描述符、信号处理配置和一个或多个执行流。线程是这些执行流在用户态的抽象。Linux 内核最终调度的是 `task_struct` 对应的任务，进程与线程的差别主要来自创建时共享了哪些资源。

<div class="note-flow"><span>启动一个进程</span><i>→</i><span>创建多个线程</span><i>→</i><span>内核为每个执行流维护 task</span><i>→</i><span>共享地址空间与文件</span><i>→</i><span>分别参与调度和信号投递</span></div>

<figure class="note-visual"><figcaption><span>进程线程图</span>同一线程组共享大部分进程资源，但每个线程仍有独立的执行现场和调度状态。</figcaption><div class="note-map"><span><b>PID</b><small>线程组 ID 通常由主线程占用，也是大多数工具默认显示的进程号。</small></span><span><b>TID</b><small>每个线程自己的任务 ID，调度、绑核和线程定向信号会用到。</small></span><span><b>task_struct</b><small>内核保存调度、状态、凭据和资源引用的任务对象。</small></span><span><b>地址空间</b><small>同一进程的线程共享代码、堆和映射，但每个线程有自己的栈。</small></span><span><b>文件表</b><small>线程通常共享打开文件；一个线程关闭 fd 会影响其他线程。</small></span><span><b>信号</b><small>进程级 pending、线程屏蔽字和线程定向信号需要分别理解。</small></span></div></figure>

## 用命令先看到线程

```bash
ps -eLf
ps -T -p <PID>
top -H -p <PID>
ls /proc/<PID>/task
```

`ps -T` 会列出同一进程里的线程，`/proc/<PID>/task` 下每个目录名都是一个 TID。主线程的 TID 通常等于 PID，其他线程有各自的 TID。调试线程绑核时，应检查具体 TID，而不是只看进程号。

```bash
grep -E '^(Name|Pid|Tgid|Threads|Cpus_allowed_list):' /proc/<PID>/status
grep -E '^(Name|Pid|Tgid|Cpus_allowed_list):' /proc/<PID>/task/<TID>/status
```

`Tgid` 是线程组 ID，`Pid` 在任务状态文件里表示该 task 的 ID。工具的列名不完全一致，排查时最好回到 `/proc` 核对。

### 写一个程序打印 PID 和 TID

```c
#define _GNU_SOURCE
#include <pthread.h>
#include <stdio.h>
#include <sys/syscall.h>
#include <unistd.h>

static void print_identity(const char *name) {
    printf("%s: pid=%d tid=%ld\n", name, getpid(), syscall(SYS_gettid));
}

static void *worker(void *arg) {
    (void)arg;
    print_identity("worker");
    return NULL;
}

int main(void) {
    pthread_t thread;
    print_identity("main");
    pthread_create(&thread, NULL, worker, NULL);
    pthread_join(thread, NULL);
    return 0;
}
```

```bash
gcc -O2 -Wall -Wextra -pthread pid_tid.c -o pid_tid
./pid_tid
```

两行输出的 PID 相同，TID 不同。这个实验是理解线程绑核、线程定向信号和 `/proc/<PID>/task` 的起点。

## 哪些资源共享，哪些独立

同一进程的线程通常共享虚拟地址空间、打开文件、当前工作目录和信号处理函数。它们有独立的寄存器、用户栈、线程局部存储、调度策略、CPU affinity 和信号屏蔽字。

共享地址空间让线程通信很快，也让错误互相影响。一个线程写坏堆内存，另一个线程可能稍后才崩；一个线程关闭共享 fd，其他线程继续使用时会失败。线程安全不是“用了 mutex 就结束”，还要说清对象生命周期、退出顺序和取消路径。

## fork 和 pthread_create 不做同一件事

`fork()` 创建新的进程视图，子进程获得独立的虚拟地址空间语义，物理页通常先通过写时复制共享。`pthread_create()` 创建同一进程中的新线程，直接共享地址空间和文件表。

在 Linux 内核里，两者最终都依赖类似 `clone` 的资源共享选择。用户程序应使用 `fork()` 和 pthread 接口，不要因为内核实现相近就混用语义。

## 调度器看到的是什么

调度器选择的是可运行 task。两个线程属于同一进程，也会分别进入运行队列，拥有各自的调度策略、优先级和 affinity。一个进程有八个 CPU 密集线程，就可能同时占用八颗 CPU；“只有一个 PID”不代表只使用一个核心。

这也是后续绑核文章要按线程检查的原因：

```text
进程资源范围：地址空间、文件、凭据
线程调度范围：TID、策略、优先级、CPU mask
系统干扰范围：IRQ、softirq、其他进程和内核工作
```

## 退出时容易漏掉什么

主线程从 `main()` 返回会终止整个进程；某个工作线程返回只结束自己。Joinable 线程退出后仍保留少量状态，直到其他线程 `pthread_join()`；detached 线程则由线程库自动回收。没有设计 join、detach 和停止协议，长期运行服务会积累资源或在退出时访问已销毁对象。

理解这一层后，可以继续看[线程绑核](/2026/02/06/linux-thread-cpu-affinity/)和[周期控制循环](/2026/02/27/linux-periodic-control-loop-basics/)。前者操作具体 TID 的 CPU 集合，后者把 affinity、调度和 deadline 放进同一个循环。

## 参考资料

- [pthreads(7)](https://man7.org/linux/man-pages/man7/pthreads.7.html)
- [clone(2)](https://man7.org/linux/man-pages/man2/clone.2.html)
- [proc_pid_task(5)](https://man7.org/linux/man-pages/man5/proc_pid_task.5.html)
- [sched(7)](https://man7.org/linux/man-pages/man7/sched.7.html)

**证据边界：**本文解释 Linux 用户态线程与内核 task 的基本关系，没有覆盖所有 namespace、凭据和信号细节。命令输出会受发行版、工具版本和容器环境影响。
