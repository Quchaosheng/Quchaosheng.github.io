---
title: 把项目经验写成可公开文章：保留方法，删除秘密
date: 2026-08-25 09:30:00
permalink: /2026/08/25/project-evidence-chain-retrospective/
categories: [技术, 项目方法]
tags: [工程复盘, 证据链, 保密, 系统方法]
---

从 8 月 14 日到今天，这组札记依次整理了共享数据、跨层时延、设备确认、采集架构、BSP、驱动生命周期、任务取消、确定性回放、CAN 故障验证、视觉 Guard 和 RISC-V 边界。它们来自实际工程中反复遇到的问题，但文章刻意只留下可迁移的方法。

## 我如何判断一段经验能不能公开

首先删除能够识别业务和现场的信息：公司与客户名称、未公开项目名、设备序列、网络拓扑、接口地址、协议字段、日志原文和数据样本。其次删除可能暴露能力边界的参数：频率、阈值、超时、资源规模、故障统计和未公开性能结果。

最后检查结论是否越过证据。仿真结果只写仿真，软件注入只写软件路径，测试集合只说明覆盖了哪些场景，不转换成生产成功率。涉及安全时，软件 cancel、STOP 或 ACK 都不能写成物理安全保证。

<div class="note-flow"><span>抽象问题</span><i>→</i><span>描述决策</span><i>→</i><span>给出验证方法</span><i>→</i><span>写明适用边界</span></div>

<div class="note-map"><span><b>删除</b><small>身份、参数与原始材料</small></span><span><b>保留</b><small>问题、决策与反例</small></span><span><b>约束</b><small>环境与证据范围</small></span></div>

## 一篇工程文章应该留下什么

我更愿意保留四件事：当时要区分哪些问题，为什么采用这一结构，怎样设计反例，以及结论在哪些条件下成立。工具名可以帮助读者复现，但不应代替推理。数字只有在来源、版本和环境都能公开时才有意义。

这套写法也改善了项目复盘：先写一句结论，再写问题、动作、验证和边界。证据冲突时保留候选方向，证据缺失时明确 unknown。文章因此不必靠夸张结果吸引注意，读者仍能获得一条可复用的排障路径。

## 系列索引

- [共享数据与版本化快照](/2026/08/14/versioned-snapshot-for-shared-data/)
- [跨层时延三段法](/2026/08/15/cross-layer-latency-segmentation/)
- [设备命令的三阶段确认](/2026/08/16/ack-is-not-completion/)
- [多源采集平台的故障边界](/2026/08/17/modular-multisource-data-pipeline/)
- [BSP Bring-up 排障顺序](/2026/08/18/bsp-bringup-evidence-order/)
- [驱动卸载与生命周期](/2026/08/19/driver-remove-lifecycle-order/)
- [ROS 2 deadline 与 cancel](/2026/08/20/ros2-deadline-cancel-budget/)
- [Schema 与确定性回放](/2026/08/21/schema-and-deterministic-replay/)
- [SocketCAN 故障注入边界](/2026/08/22/socketcan-fault-injection-boundaries/)
- [视觉任务的持续 Guard](/2026/08/23/vision-admission-guards/)
- [QEMU RISC-V 边界验证](/2026/08/24/qemu-riscv-boundary-validation/)

## 参考资料

- [OWASP information exposure guidance](https://owasp.org/www-community/vulnerabilities/Information_exposure_through_query_strings_in_url)
- [NIST privacy framework](https://www.nist.gov/privacy-framework)

## 证据边界

本系列不代表任何单位的内部架构或技术方案。文中场景经过抽象与改写，不包含私有代码、协议、参数、日志、数据或客户信息；它们是个人对通用工程方法的总结。
