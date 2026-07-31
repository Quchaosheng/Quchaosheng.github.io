---
title: TensorRT 机器人推理：从训练模型到稳定延迟
date: 2026-07-21 14:00:00
permalink: /2026/07/30/tensorrt-robot-inference/
categories: [技术, AI机器人]
tags: [TensorRT, ONNX, 推理优化]
---

电脑上单张图片推理很快，放到机器人连续跑半小时后，检测结果却越来越晚。TensorRT 会解析 ONNX、融合算子、选择 kernel 和内存布局，再为目标 GPU 构建 engine；FP16/INT8 只解决其中一部分计算成本，队列、温度和其他节点仍可能让结果过期。

<div class="note-flow"><span>导出 ONNX 模型</span><i>→</i><span>校验算子与精度</span><i>→</i><span>构建目标设备 engine</span><i>→</i><span>预分配并预热推理</span><i>→</i><span>测量端到端延迟与精度</span></div>

<figure class="note-visual"><figcaption><span>时延图</span>模型、engine、缓冲区和队列要一起看，单独缩短 GPU 时间不等于感知结果更及时。</figcaption><div class="note-map"><span><b>ONNX 输入契约</b><small>opset、形状、颜色、归一化和后处理必须与训练保持一致。</small></span><span><b>目标 engine</b><small>与 GPU 架构、TensorRT、CUDA 和优化 profile 一起固定版本。</small></span><span><b>预分配缓冲</b><small>启动时建立 context、stream 和输入输出内存，避免每帧动态分配。</small></span><span><b>异步执行</b><small>用明确 stream 依赖连接预处理、推理和后处理，避免隐式同步。</small></span><span><b>队列策略</b><small>持续输入时要决定丢旧帧、限队列还是让结果逐渐过期。</small></span><span><b>端到端时间</b><small>同时记录采集、入队、推理完成和消费时刻，得到真正的 frame age。</small></span></div></figure>

## 先排除预处理和版本差异

**导出正确**：固定 opset、输入名称、坐标约定和前后处理。很多“推理精度下降”其实是 RGB/BGR、归一化、letterbox 或 NMS 参数和训练时不一致。

**形状可控**：如果模型有动态 batch 或动态分辨率，构建 engine 时需要为输入设置优化 profile。profile 覆盖的形状越宽，运行时适应性越高，但可能牺牲特定尺寸的最优 kernel。机器人若只使用一种相机分辨率，固定形状通常更容易获得稳定时延。

**精度可验**：FP16 通常是较稳妥的第一步。INT8 需要有代表性的校准数据，且要分别统计关键类别的漏检、误检和距离/姿态误差；不能只比较一个总体 mAP。

**版本不可混用**：序列化 engine 通常与 GPU 架构、TensorRT 版本、CUDA 驱动和构建配置相关。将 A 设备上生成的 engine 直接拷到 B 设备，可能无法加载，也可能性能不如本机构建。

## 先看哪一段在等

稳定延迟依赖稳定的内存生命周期。每帧 `cudaMalloc`、创建 execution context、从默认流同步、在 CPU 与 GPU 之间来回拷贝，都会引入可变成本。较好的做法是启动时创建 context 和 CUDA stream，预分配输入/输出 buffer，做足预热，再在同一 stream 上异步投递工作。

```cpp
context->setInputShape("images", input_dims);
context->setTensorAddress("images", device_input);
context->setTensorAddress("output", device_output);
context->enqueueV3(stream);  // 与预处理、后处理使用明确的 stream 依赖
```

这段接口只展示 TensorRT 的核心调用。实际项目还要管输入何时可读、输出何时可用，以及异常时怎样丢掉过期帧。控制侧不应等待已经过期的推理结果。

## 把 benchmark 和机器人时间分开

至少记录五个时间点：相机采集、进入预处理、开始 GPU 推理、推理完成、控制/规划模块消费结果。由此可以同时看出模型计算时间、排队时间和感知年龄。

```text
frame_age = decision_time - camera_stamp
queue_wait = inference_start - enqueue_time
gpu_time = inference_end - inference_start
```

若 `gpu_time` 稳定而 `frame_age` 却不断增加，应优先处理队列与丢帧策略；若 GPU 时间随温度变大，则检查功耗模式、热设计和其他 CUDA 任务；若精度在弱光下失效，则要回到数据和模型，而不是盲目调 TensorRT。

参考：[NVIDIA TensorRT Documentation](https://docs.nvidia.com/deeplearning/tensorrt/latest/) · [TensorRT API Reference](https://docs.nvidia.com/deeplearning/tensorrt/latest/_static/c-api/)

**证据边界：**本文给出 TensorRT 部署的测量方法，没有给出特定模型、GPU 或 JetPack 版本的性能和精度结果。engine 兼容性、功耗、温度和 P99 延迟需要在目标设备上重新记录。
