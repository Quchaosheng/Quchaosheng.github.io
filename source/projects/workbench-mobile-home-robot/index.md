---
title: Workbench Mobile Home Robot
date: 2026-09-21 09:00:00
layout: page
description: 证据优先的移动家务机器人运行时：受限语义动作、可回放事件库，以及能给出 confirmed / refuted / insufficient_evidence 三态结论的验证器。
cover: /image/projects/workbench-dashboard.png
---

<div class="page-lead"><p class="section-kicker">项目说明</p><p>Workbench 是面向移动家务机器人的证据优先运行时。它把「命令已被接受」和「任务已经完成」分开：意图只能在小而严格的动作词表里选择，执行由受信运行时下发并记录，完成判定交给检查观测的验证器。判定结果有三态——<code>confirmed</code>、<code>refuted</code>、<code>insufficient_evidence</code>，证据不足时不会猜成成功。产品品牌叫 VORA Home Robot，工程仓库与运行时名称是 <code>workbench-mobile-home-robot</code>（Workbench）。</p></div>

<figure class="project-hero-image"><img src="/image/projects/workbench-dashboard.png" alt="Workbench 只读看板：任务队列、事件序列与安全边界状态"></figure>

<div class="project-facts"><div><span>运行时</span><strong>Python 3.12 · 离线可跑 · 不需要 GPU</strong></div><div><span>完成判定</span><strong>confirmed / refuted / insufficient_evidence</strong></div><div><span>证据资产</span><strong>12 冻结场景 · 24 扩展场景 · 50 golden task</strong></div></div>

## 完成判定凭什么成立

<div class="note-flow"><span>目标</span><i>→</i><span>受限规划器<br>动作词表</span><i>→</i><span>语义动作<br>受信执行器</span><i>→</i><span>事件库<br>追加式 SQLite</span><i>→</i><span>验证器<br>检查观测</span><i>→</i><span>回放 / 看板</span></div>

执行侧只负责「下发并记录」，验证侧单独检查动作之后的证据。两侧分开之后，一个 <code>OK</code> 返回值最多只能推进到 <code>acknowledged</code>，要变成 <code>verified</code> 必须有覆盖任务判据的新鲜观测。

## 代码里有什么

<div class="note-map"><span><b>三态验证</b><small>证据充分才 confirmed；冲突为 refuted；缺失标为 insufficient_evidence。</small></span><span><b>事件库</b><small>追加式 SQLite 存储，带完整性校验的回放与快照备份。</small></span><span><b>动作策略</b><small>受限语义工具做失败关闭式校验，非法请求被拒绝而不是降级执行。</small></span><span><b>严格契约</b><small>11 个 JSON schema 与对应的 Pydantic 模型约束输入输出。</small></span><span><b>看板</b><small>只读 dashboard 展示任务队列、事件序列和边界状态。</small></span><span><b>设备基础</b><small>MCU、CAN、Motion、BSP 的软件边界与确定性仿真 fixture。</small></span></div>

## 先跑一次

要求 Python 3.12，离线运行时不需要 GPU。

```bash
git clone https://github.com/Quchaosheng/workbench-mobile-home-robot.git
cd workbench-mobile-home-robot
python -m pip install -e ".[dev]"
python tools/scripts/sim_cli.py doctor
python tools/scripts/sim_cli.py run normal-001 --runner scripted --output-dir runs/demo
```

脚本 runner 会输出包含 manifest、场景、事件、日志、metadata 和 SHA-256 checksum 的可回放 artifact，并明确标记为 `SCRIPTED_FIXTURE`。

## 这些数字怎么复核

评测资产的数量可以直接用仓库里的脚本重算，不需要额外环境：

```bash
python3 tools/scripts/validate_golden_set.py
```

它输出的就是 `50 tasks across 5 families and 26 dangerous requests`——12 个冻结场景、24 个扩展场景、五个任务族共 50 个 golden task，另有 26 个危险请求专门验证系统是否会拒绝不该执行的动作。这些数字描述的是仓库中的测试资产数量，不是现实世界里的成功率。

## 这能说明什么

- 三态判定、追加式事件库、完整性校验回放、失败关闭式动作策略和只读看板这条软件链路可以离线复现。
- 用 `scripted` runner 跑出的结果只是确定性 fixture，证明的是流程与判定逻辑，不是策略能力。
- 没有验证真实电机运动、硬件急停、DDS 安全或闭环机器人控制；MCU、CAN、Motion、BSP 目前都停在软件边界。
- 仿真和虚拟总线只能说明软件路径跑通，不能代替真机结论。

接真实执行器之前，安全链路和闭环反馈需要单独设计和测试。

**链接：** [GitHub 源码与文档](https://github.com/Quchaosheng/workbench-mobile-home-robot) · [项目总览](/projects/)
