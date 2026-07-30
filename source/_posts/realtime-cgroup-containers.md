---
title: 容器里的实时任务：cgroup、权限和 CPU 配额如何共同生效
date: 2026-07-20 14:00:00
permalink: /2026/07/30/realtime-cgroup-containers/
categories: [技术, Linux实时]
tags: [cgroup, 容器, CAP_SYS_NICE]
---

容器把进程、文件系统和资源视图隔开，却不提供一套新的实时内核。容器中的线程仍由宿主机同一个调度器、同一组 IRQ、同一块缓存和同一套功耗策略管理。因此“进容器后 `chrt` 成功了”只证明进程拿到了调度权限，不证明它已经获得稳定的 CPU、内存或设备时延。

<div class="note-flow"><span>授予最小调度权限</span><i>→</i><span>配置 cpuset 与内存节点</span><i>→</i><span>核对 CPU/RT 预算</span><i>→</i><span>迁移宿主 IRQ 与杂务</span><i>→</i><span>在容器内外联合压测</span></div>

## 容器里实时性由哪几层共同决定

进程能否设置实时策略通常受 `CAP_SYS_NICE`、`RLIMIT_RTPRIO` 和宿主机安全策略约束；能在哪些 CPU 上运行由 cpuset 决定；普通 CPU 配额会限制 cgroup 的可用时间；内存节点选择则会影响 NUMA 本地性。不同内核版本和 cgroup 层级对实时带宽控制的支持也有差异，因此要查看实际 controller 和运行时配置，而不是假设 Docker/Kubernetes 有一个通用“实时模式”。

<div class="note-map"><span><b>权限</b><small>CAP_SYS_NICE 与 rlimit 决定能否请求 RT 调度策略和优先级</small></span><span><b>cpuset</b><small>限制可运行 CPU 与内存节点，是隔离的基础</small></span><span><b>CPU 配额</b><small>配额不足会让容器即使有 RT 线程也出现资源限制</small></span><span><b>宿主 IRQ</b><small>中断仍先发生在宿主机，必须单独规划亲和性</small></span><span><b>cgroup 层级</b><small>父级限制可能覆盖容器自身看起来正确的配置</small></span><span><b>验证原则</b><small>容器内看线程，容器外看 CPU、IRQ、温度和其他租户</small></span></div>

## 不要把特权当作解决方案

为了设置 FIFO，一些部署会直接给容器 `--privileged`。这扩大了攻击面，也掩盖了真正需要的最小权限。更好的做法是只授予需要的 capability、设定明确的 `rtprio`/memlock 限制，并通过 cpuset 限制容器不会漂移到不属于它的 CPU。权限让线程可以请求资源，资源规划才决定它能否按期完成。

容器内外应同时检查：

```bash
# 容器内：调度类、优先级和允许的 CPU
ps -eLo pid,tid,psr,cls,rtprio,comm
grep Cpus_allowed_list /proc/self/status

# 宿主机：实际中断与 cgroup CPU 约束
cat /proc/interrupts
```

路径和 controller 名称会因 cgroup v1/v2、systemd 和运行时而不同，但“查看宿主机真相”这一步不能省。

## 一种可控的部署模式

将实时容器限制在一组专门 CPU，将非实时 API、日志、图像编码和批处理放在另一组 CPU；宿主机把无关 IRQ、RCU 和 worker 移到 housekeeping CPU。容器中的实时线程使用固定容量内存和 watchdog，控制器对超时输入进行安全降级。这样容器负责交付和隔离，宿主机仍负责系统级实时布局。

验收时必须同时制造容器内负载和宿主机负载，例如邻居容器 CPU/内存压力、网卡高流量、日志轮转、镜像更新。容器空载下的 P99 并不能代表共部署后的表现。

参考：[Control Group v2](https://docs.kernel.org/admin-guide/cgroup-v2.html) · [sched(7)](https://man7.org/linux/man-pages/man7/sched.7.html)
