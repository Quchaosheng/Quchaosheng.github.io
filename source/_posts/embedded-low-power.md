---
title: 嵌入式低功耗：从功耗预算到睡眠唤醒
date: 2026-06-22 14:00:00
permalink: /2026/07/29/embedded-low-power/
categories: [技术, 嵌入式]
tags: [低功耗, 睡眠, 电源管理]
---

低功耗不是只把 MCU 切进最深睡眠。设备的续航由每一种状态的电流和驻留时间共同决定：一次高电流的无线发送、一个没有关掉的传感器、频繁的误唤醒，都可能比休眠电流高几微安更值得处理。先做能量预算，再选睡眠状态和唤醒策略。

<div class="note-flow"><span>任务完成并计算下一截止期</span><i>→</i><span>关闭外设与时钟</span><i>→</i><span>进入睡眠</span><i>→</i><span>RTC/GPIO/通信唤醒</span><i>→</i><span>恢复上下文与任务</span></div>

<figure class="note-visual"><figcaption><span>功耗图</span>平均电流取决于状态电流与驻留时间的乘积。</figcaption><div class="note-map"><span><b>活动状态</b><small>CPU、射频、DMA 和外设同时工作，电流通常最高。</small></span><span><b>等待状态</b><small>CPU 停止但部分时钟和外设仍保留，便于快速恢复。</small></span><span><b>深睡眠</b><small>关闭更多电源域，节能更多但唤醒成本更高。</small></span><span><b>唤醒源</b><small>RTC、GPIO、通信和比较器都可能造成计划外唤醒。</small></span><span><b>外设电源</b><small>传感器、Flash、调试器和 IO 电平会产生板级漏电。</small></span><span><b>时间预算</b><small>记录每种状态持续多久，才能解释平均电流。</small></span></div></figure>

## 先算平均电流，再优化最低电流

可以把一个工作周期拆成若干状态，按 `I_avg = Σ(I_state × t_state) / T` 粗略估算平均电流。这个公式会直接暴露问题：若设备每分钟只采一次样，却因为轮询或错误中断每秒醒来几次，先减少唤醒次数通常比继续压低深睡眠电流有效。

每次优化都要记录采样周期、无线发送次数、外设开启时长和温度。只有同一业务负载下的平均电流才可比较，不能拿“什么都不做”的最低数字当续航结论。

## 唤醒后先恢复必要资源

进入睡眠前要明确哪些时钟、引脚、DMA 缓冲区和外设状态会丢失；唤醒后按依赖顺序恢复。深睡眠下调试接口、外部传感器供电和通信模块的行为常与普通暂停不同，必须在真实板上测量。排查异常电流时，也要断开调试器并检查 IO 是否通过保护二极管向未上电外设反向供电。

参考：[EmbedSummary](https://github.com/ZhengNianLi/EmbedSummary)
