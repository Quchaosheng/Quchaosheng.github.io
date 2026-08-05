---
title: 一个负结果：为什么 CPU 压力没有让调度等待整体上升
date: 2026-08-15 09:30:00
allow_future: true
permalink: /2026/08/15/f3-cpu-pressure-negative-result/
categories: [技术, 性能分析]
tags: [eBPF, ROS 2, 调度, stress-ng, 实验]
---

我最初对 F3 实验的预期很直接：把 ROS 进程树和受控 `stress-ng` 工作线程固定到同一 CPU，规划器主线程从 runnable 到 running 的等待时间应该上升。若这个解释成立，我还应该看到 RuntimeEvent 的 dispatch 延迟整体变长。

正式实验没有给出这个结论。压力确实破坏了路径完整性，也把尾部延迟拉长了，但成功匹配样本的调度等待中位数反而下降。

<div class="note-flow"><span>固定同一 CPU</span><i>→</i><span>注入 stress-ng</span><i>→</i><span>采集 RuntimeEvent/eBPF</span><i>→</i><span>解释缺失与尾部</span></div>

<figure class="note-visual"><figcaption><span>结果不是一条曲线</span>完整率下降、尾部变长和幸存样本中位数下降同时出现。</figcaption><div class="note-map"><span><b>完整性</b><small>95.30% 降到 67.56%。</small></span><span><b>dispatch p99</b><small>14.684 ms 升到 53.183 ms。</small></span><span><b>scheduler median</b><small>57.989 us 降到 9.100 us。</small></span><span><b>缺失机制</b><small>必须先解释采集窗口和右删失。</small></span></div></figure>

## 实验怎样做

正式环境是 Ubuntu 24.04、ROS 2 Jazzy 和 native Linux。F3 control 与 injected 各做 10 次配对重复，固定 seed 为 `20260729`。完整 F3/F4 矩阵 40/40 case 成功执行。

一条分析统计 RuntimeEvent 的完整生命周期，另一条从 eBPF `sched_wakeup` 到 `sched_switch` 构造规划器主线程的 runnable-to-running 间隔。调度样本必须满足：

```text
process_manifest.kernel_pid == eBPF tid/next_tid
```

我按 run 配对，没有把所有事件池化成彼此独立的样本。同时保留采集时长、wakeup 数和缺失路径，因为这些数字后来决定了结论能不能成立。

## 与预期冲突的结果

最稳定的结果是完整路径恢复率从 95.30% 降到 67.56%。原始数量为 control 7003/7348，injected 4653/6887。配对 complete-rate 差异中位数为 -0.437，95% bootstrap CI 为 [-0.458, -0.017]。

延迟却没有整体同向移动：

| 指标 | control | injected |
| --- | ---: | ---: |
| dispatch 上界中位数 | 0.5115 ms | 0.2597 ms |
| dispatch p95 | 0.879 ms | 3.013 ms |
| dispatch p99 | 14.684 ms | 53.183 ms |
| scheduler pooled median | 57.989 us | 9.100 us |
| 匹配 wakeup-switch | 7970 | 2745 |

10 个配对 run 中，9 个 scheduler 中位数差为负。与此同时，injected 多次只捕获约 2.0 到 2.3 秒，control 多为 5.6 到 6.1 秒。分析最终标记 `trace_level_attribution=false`。

## 为什么中位数下降不代表系统变快

injected 条件有 2234 条不完整生命周期。只有完成并成功配对的 trace 才进入延迟统计，最慢、被截断或未完成的请求更容易消失。剩下的“幸存样本”中位数降低，完全可能是选择偏差。

调度分析也只覆盖捕获窗口内成功匹配的 wakeup-switch。match rate 高，只能说明进入分析的 wakeup 大多找到了 switch，不能证明窗口外和提前终止的路径不存在。control 与 injected 的捕获时长不同，使两组暴露时间不等价。

此外，`dispatch_upper_bound_ns` 包含传输与回调 dispatch 上界，eBPF 间隔只测主线程的一段调度等待。两个指标相关，但不是同一个量。

所以这轮正式结论是：同核 CPU 压力降低了完整路径恢复率，并暴露 dispatch 尾部风险；它没有证明 scheduler latency 整体上升。

## 下一轮要先修实验，而不是多跑几次

下一轮需要固定 control 与 injected 的墙钟捕获窗口，设置对称 warm-up/cool-down，并记录缓冲区丢失原因。每个请求还要预注册 expected lifecycle，把完整、右删失、捕获丢失和应用未完成分开统计。

只有在固定窗口下，identity-bound scheduler 指标与同一 trace 的 dispatch 尾部在 run 级共同变化，且缺失机制可解释，我才会重新讨论调度因果归因。

## 证据边界

这轮结果支持“同核 CPU 压力降低完整路径恢复率，并暴露 dispatch 尾部风险”。它不支持“CPU 压力使 scheduler latency 整体上升”，也不支持从 WSL proxy 结果外推 native Linux 的调度因果归因。

复核入口和原始结果索引可在 [RoboTraceOpt 提交 e669591](https://github.com/Quchaosheng/RoboTraceOpt/commit/e669591c5955126e974ed7a4dcd760478f46cc21) 中找到。

```bash
python3 -m json.tool docs/evidence/native-f3f4-formal-v3/results/scheduler_analysis.json
python3 -m json.tool docs/evidence/native-f3f4-formal-v3/results/paired_statistics.json
sha256sum -c docs/evidence/native-f3f4-formal-v3/SHA256SUMS.txt
```

这次负结果比原假设更有用。它提醒我先解释缺失和采集窗口，再解释中位数。否则一条看似漂亮的调度曲线，可能只描述了压力下仍然活着的那部分样本。
