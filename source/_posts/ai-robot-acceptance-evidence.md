---
title: 从实验室到现场：AI 机器人验收报告怎样区分证据
date: 2026-08-25 09:30:00
allow_future: true
permalink: /2026/08/25/ai-robot-acceptance-evidence/
categories: [技术, AI机器人]
tags: [验收, 证据, 仿真, 台架, 真机]
---

演示视频里机器人连续抓取了五次，现场验收却没有通过。评审问的是环境温度、模型版本、失败时怎么停、结果年龄是多少，报告里只有一张成功率截图。问题不一定是系统变差，而是报告把仿真、台架和真机证据混在了一起，读者无法知道每个结论到底由什么支持。

AI 机器人验收不该只写一个总分。感知、规划、控制和安全链路需要不同证据；成功率、P99 延迟、人工接管率和安全事件也不能互相替代。报告的任务是让别人知道“在哪些条件下观察到了什么”，以及“哪些地方还没有证据”。

<div class="note-flow"><span>定义任务和失败条件</span><i>→</i><span>固定代码、模型和设备指纹</span><i>→</i><span>分别收集仿真、台架、真机证据</span><i>→</i><span>记录成功、拒绝和安全事件</span><i>→</i><span>给结论标注边界</span></div>

<figure class="note-visual"><figcaption><span>证据分层图</span>每个结论都要能追溯到运行环境、输入、指标和原始记录。</figcaption><div class="note-map"><span><b>仿真</b><small>验证状态机、接口和可控扰动，不能直接证明硬件行为。</small></span><span><b>vcan/QEMU</b><small>验证协议、错误码和软件路径，不能代表真实总线时序。</small></span><span><b>台架</b><small>在固定硬件上测延迟、负载和故障注入，环境仍然有限。</small></span><span><b>真机</b><small>验证传感器、执行器、温度、振动和现场约束。</small></span><span><b>指标</b><small>记录成功率、尾延迟、拒绝、接管和安全事件，而非只记平均值。</small></span><span><b>限制</b><small>写明没有测什么，避免把局部结果扩成产品承诺。</small></span></div></figure>

## 先把“成功”写成可判定的条件

“完成抓取”至少要说明目标类别、位置误差、夹爪状态和任务时间。移动机器人还要写停止距离、路线是否越过禁区和地图年龄。没有判定条件，测试人员会在现场凭感觉决定一次算不算成功。

失败也要分类。目标不存在、规划不可达、控制超时、传感器过期、急停触发和人工接管不能都记成一个 `failed`。它们对应的修复人和验收动作不同。

## 环境指纹必须和结果放在一起

每次测试至少保存代码 commit、模型摘要、容器或系统镜像、硬件型号、JetPack/ROS 2 版本、配置文件、传感器标定、功耗模式和随机种子。可以用下面的命令先生成一份简短指纹：

```bash
git rev-parse HEAD
uname -a
ros2 doctor --report
ros2 pkg list | sort
sha256sum model.engine config.yaml
```

命令输出不等于完整 BOM，但能防止“同名版本”在不同设备上悄悄漂移。对真机测试，还要记录温度、供电、网络和操作者身份。

一次验收运行可以先用下面的 JSON 建档。它不是行业标准，只是为了把版本、判据和原始文件绑到同一个 `run_id`。

```json
{
  "run_id": "pick-20260825-001",
  "task": "bin_pick_v2",
  "code_commit": "<git commit>",
  "model_sha256": "<sha256>",
  "config_sha256": "<sha256>",
  "device": {"id": "robot-03", "power_mode": "<mode>"},
  "environment": {"site": "bench-a", "temperature_c": null},
  "acceptance": {
    "success_definition": "目标进入指定区域且夹爪保持 3 秒",
    "timeout_s": 20,
    "max_result_age_ms": 120
  },
  "artifacts": ["events.jsonl", "diagnostics.log", "camera.mcap"],
  "not_covered": ["透明物体", "无线断链"]
}
```

建档后先做机器可读检查，再开始跑任务：

```bash
python3 -m json.tool run.json >/dev/null
sha256sum model.engine config.yaml camera.mcap > SHA256SUMS
git status --short
```

`events.jsonl` 建议一行保存一个任务事件，至少包含 `run_id`、事件 ID、输入时间、结果时间、最终状态、失败类别、是否人工接管和关联文件。不要在测试结束后只手工抄一张汇总表，原始事件一旦丢掉，就无法重新计算阈值或核对异常样本。

## 三类证据不能混写

仿真适合验证状态机、取消、超时和可重复扰动。vcan 或 QEMU 适合验证协议、错误码和恢复路径。台架能测目标硬件上的资源、延迟和故障注入。真机才有传感器曝光、机械间隙、执行器饱和、温度和现场障碍物。

报告可以用一张证据表把边界写清楚：

| 结论 | 环境 | 原始记录 | 可以支持 | 不能支持 |
| --- | --- | --- | --- | --- |
| CAN 帧 CRC 正确 | vcan | 帧日志与测试脚本 | 协议实现路径 | 实车电气抗干扰 |
| 推理 P99 在预算内 | 台架 | 时间戳、温度、负载 | 该设备条件下的延迟 | 所有相机和场景 |
| 抓取成功率 | 真机 | 任务日志、失败视频 | 指定任务和物体集合 | 未测物体与环境 |
| 急停动作完成 | 真机 | 安全 I/O 和驱动记录 | 当前硬件链路 | 软件模拟的等价结论 |

不要把“仿真里没有碰撞”写成“机器人不会碰撞”，也不要把一次真机演示写成全场景成功率。

## 指标要把尾部和人工行为算进去

平均推理时间不能说明机器人会不会迟到。至少保留 P50、P95、P99、结果年龄、丢帧、拒绝、人工接管和安全事件。人工接管不是测试失败的噪声，它可能暴露出模型置信度、界面和降级策略的真实成本。

每次失败要有事件 ID，关联原始输入、模型候选、规划结果、控制命令、诊断和最终状态。没有事件 ID，多个传感器和日志文件很快会失去对应关系。

## 发布报告前逐项关账

| 检查项 | 需要留下的证据 | 常见的不合格写法 |
| --- | --- | --- |
| 任务判据 | 可计算的成功、超时和拒绝条件 | “抓取效果正常” |
| 样本构成 | 物体、场景、速度和重复次数 | 只有总样本量 |
| 版本指纹 | commit、模型与配置摘要、设备信息 | 只写产品版本名 |
| 尾部指标 | P95/P99、结果年龄、最长超时 | 只有平均耗时 |
| 失败样本 | 事件 ID、日志、传感器片段和处置 | 删除失败视频 |
| 安全动作 | 触发条件、I/O 或驱动记录、最终状态 | 只截急停按钮照片 |
| 未覆盖项 | 明确列出没有测试的条件 | “其他场景后续验证” |

延迟口径可以接着看[视觉伺服的端到端延迟预算](/2026/08/04/ai-robot-visual-servo-latency-budget/)，故障样本的留存与复现方法见[用 rosbag2 保存一次真正可复现的失败](/2026/08/24/ai-robot-rosbag2-failure-replay/)。模型精度变更则应按[TensorRT 精度回归](/2026/08/10/ai-robot-tensorrt-precision-regression/)中的分层方式单独核对，不能塞进一个总成功率里。

## 验收报告最后要写“不知道什么”

证据不足时，直接写限制比补一句“总体表现良好”有用。比如只在室内、低速、单目标和固定光照下测试，就说明这些条件；没有测雨天、玻璃反光、无线断链和长时间热稳定，就列为未覆盖项。后续补测可以沿着未覆盖项排优先级。

这种写法不会削弱报告，反而让别人知道下一步该怎么复核。对机器人系统而言，边界清楚比漂亮的单个数字更重要。

## 参考资料

- [ROS 2 Concepts](https://docs.ros.org/en/jazzy/Concepts.html)
- [ROS 2 bag recording](https://docs.ros.org/en/jazzy/Tutorials/Advanced/Recording-A-Bag-From-Your-Own-Node-Py.html)
- [NVIDIA Isaac Sim documentation](https://docs.isaacsim.omniverse.nvidia.com/latest/)
- [NVIDIA Jetson documentation](https://docs.nvidia.com/jetson/)

**证据边界：**本文给出的是验收报告结构和证据分层方法，没有提供任何真实成功率、P99 或安全距离。每项结论都应绑定目标设备、版本、环境、样本量和原始记录。
