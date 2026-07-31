---
title: TensorRT FP16 和 INT8 精度回归：别只看推理时间
date: 2026-08-10 09:30:00
allow_future: true
permalink: /2026/08/10/ai-robot-tensorrt-precision-regression/
categories: [技术, AI机器人]
tags: [TensorRT, FP16, INT8, Jetson, 模型部署]
---

模型换成 TensorRT 以后，FPS 上去了，机器人却更容易把相似物体认错。很多团队到这一步才开始比较几张输出图，结果很难定位：问题可能来自 FP16 的累积误差、INT8 校准集、动态 shape、算子替换，也可能只是预处理的颜色顺序变了。

精度回归应该和性能回归分开测。先固定输入和预处理，把原始框架输出当作参考；再逐层比较 TensorRT 输出；最后把差异放进真正的任务指标，例如抓取目标是否选对、深度排序是否改变、控制器拒绝率是否上升。单独报告“平均误差很小”不够。

<div class="note-flow"><span>锁定输入和预处理</span><i>→</i><span>保存 FP32 参考输出</span><i>→</i><span>逐层定位差异</span><i>→</i><span>重新设计 INT8 校准集</span><i>→</i><span>用任务指标和尾延迟验收</span></div>

<figure class="note-visual"><figcaption><span>精度证据链</span>量化误差只有在输入、算子和任务结果都能对上时才有解释。</figcaption><div class="note-map"><span><b>输入契约</b><small>分辨率、颜色顺序、归一化和动态范围必须和参考模型一致。</small></span><span><b>FP32 基线</b><small>保存框架版本、权重摘要和代表性输入，避免基线自己漂移。</small></span><span><b>算子差异</b><small>融合、插件和精度选择可能让误差集中在少数层。</small></span><span><b>校准集</b><small>INT8 校准样本要覆盖真实亮度、距离、材质和遮挡，而不是只挑好看的图。</small></span><span><b>任务指标</b><small>检测、抓取或避障结果比单个张量的平均绝对误差更接近实际风险。</small></span><span><b>运行时长尾</b><small>显存、动态 shape 和 tactic 选择会同时影响 P99 延迟。</small></span></div></figure>

## 先确认两条流水线真的相同

模型精度比较前，我会把预处理单独固化。输入从相机到网络通常要经过颜色转换、缩放、裁剪、归一化和布局变换。任何一步不一致，都会让后面看起来像量化误差。

复制和预处理耗时应和数值误差分开。若需要确认 Pinned Memory、Device buffer 或 stream 同步是否拖慢链路，可以先跑[CUDA 内存与 Stream 基础实验](/2026/06/22/cuda-memory-stream-basics/)。

可以先保留一批 `.npy` 或等价的浮点输入，跳过相机和解码，直接送入两个推理路径：

```bash
trtexec --onnx=model.onnx --fp16 --dumpLayerInfo --profilingVerbosity=detailed
trtexec --onnx=model.onnx --fp16 --shapes=input:1x3x480x640 --dumpProfile
```

命令行参数会随 TensorRT 版本变化，实际使用前应以当前版本的 `trtexec --help` 为准。这两条命令用于固定构建选项并留下层级信息，一次运行证明不了模型正确。参考模型也要记录 batch、shape、布局和输出后处理版本。

## FP16 的误差通常集中在少数地方

FP16 能减少显存和带宽压力，但指数范围和尾数位数都比 FP32 小。大范围累加、归一化、softmax、坐标解码和极小概率值可能更敏感。TensorRT 还可能把多个算子融合，误差不一定能从算子名字一一对应上。

逐层检查时可以保存最大绝对误差和相对误差，但不要把接近零的张量用相对误差无限放大：

```text
abs_err = max(abs(reference - engine))
rel_err = abs(reference - engine) / max(abs(reference), epsilon)
```

若差异只在一个归一化或坐标解码层，优先考虑保留该层的 FP32 精度，或者检查输入尺度。不要一看到误差就把整个网络切回 FP32，那会掩盖真正的原因和性能代价。

## INT8 的校准集不是随机抽几张图

INT8 需要把连续值映射到有限的整数范围。校准样本决定激活范围，样本太干净或只覆盖白天场景，部署到逆光、暗处、反光材质时就可能饱和。校准集应按任务条件分层记录：亮度、距离、目标大小、遮挡、运动模糊和背景，而不是只按文件名抽样。

校准之前先做一份分布检查，至少知道每个输入通道和关键中间激活的最小值、最大值以及饱和比例。部署后若发现某类场景退化，应先回到输入分布和校准集查证，不能直接宣称“INT8 不适合机器人”。

## 差异要落到任务指标上

检测模型可以比较召回率、误检率和目标框偏差；抓取任务还要记录目标选择、姿态误差、放弃次数和控制结果。避障模型则要看近距离漏检和结果年龄。下面这张表适合放进一次回归记录：

| 层级 | 记录内容 | 不能单独说明什么 |
| --- | --- | --- |
| 张量 | 最大误差、饱和比例、NaN/Inf | 不代表任务一定失败 |
| 检测 | 召回、误检、框偏差 | 不代表机械臂一定能抓到 |
| 控制 | 拒绝次数、结果年龄、急停次数 | 不能归因到量化，除非输入和链路已对齐 |
| 性能 | P50、P99、显存峰值 | 平均 FPS 不能代表尾延迟 |

同一批输入要在 FP32、FP16 和 INT8 三个引擎上跑，构建日志、权重摘要、TensorRT 版本和 GPU 型号一并保存。模型换了后，如果只保留最终 FPS，下一次回归就没有参照物。

## 动态 shape 和 tactic 会改变结果

TensorRT 会根据 shape、硬件和构建选项选择 tactic。动态输入范围、工作空间大小和插件实现都可能改变延迟，甚至改变数值路径。Jetson 上的功耗和温度也会影响长时间运行的尾延迟。性能测试要固定输入 shape、功耗模式、预热次数和测试时长，并把 P99 与显存峰值一起记录。

```bash
tegrastats
trtexec --onnx=model.onnx --int8 --shapes=input:1x3x480x640 --dumpProfile --separateProfileRun
```

这两条命令只能帮助观察运行状态和 profile，不能代替任务级验收。校准缓存也应和模型、输入 shape 绑定，换了预处理或数据分布就要重新评估。

## 什么时候保留混合精度

如果量化只让某一类目标的召回下降，可以尝试对敏感层保留 FP16 或 FP32，或改用更合适的校准方法。代价要在报告里写明，包括增加的显存、延迟和维护复杂度。对于直接驱动机器人动作的模型，宁可明确拒绝不确定结果，也不要用一个漂亮的平均误差掩盖少数危险场景。

引擎通过回归后，还要进入[边缘模型升级与回滚](/2026/08/14/ai-robot-edge-model-ota-rollback/)的候选槽位，最后再用[机器人验收证据表](/2026/08/25/ai-robot-acceptance-evidence/)核对任务退化。数值一致、包可回滚、任务通过是三张不同的检查单。

## 参考资料

- [TensorRT accuracy considerations](https://docs.nvidia.com/deeplearning/tensorrt/latest/inference-library/accuracy-considerations.html)
- [TensorRT documentation](https://docs.nvidia.com/deeplearning/tensorrt/latest/)
- [TensorRT trtexec sample](https://github.com/NVIDIA/TensorRT/tree/main/samples/trtexec)
- [TensorRT developer guide](https://docs.nvidia.com/deeplearning/tensorrt/latest/)
- [NVIDIA Jetson Linux documentation](https://docs.nvidia.com/jetson/)

**证据边界：**本文讨论的是精度回归的测试方法，没有给出任何具体模型的误差、FPS 或抓取成功率。`trtexec` 参数和插件行为受 TensorRT 版本、GPU 和模型结构影响，发布前应记录实际环境并核对当前版本文档。
