---
title: CUDA 推理入门：Host、Device、Pinned Memory 和 Stream
date: 2026-06-22 09:30:00
permalink: /2026/06/22/cuda-memory-stream-basics/
categories: [技术, AI机器人]
tags: [CUDA, GPU, Pinned Memory, Stream, TensorRT]
---

模型 kernel 只运行 8 ms，整帧处理却用了 30 ms。剩下的时间通常藏在 CPU 到 GPU 的复制、格式转换、内存分配和同步里。要看懂 TensorRT、NITROS 和多相机优化，先把 CUDA 的 Host、Device、Pinned Memory 和 Stream 理清。

<div class="note-flow"><span>准备 Host 输入</span><i>→</i><span>复制到 Device</span><i>→</i><span>在 Stream 中执行 kernel</span><i>→</i><span>复制或消费输出</span><i>→</i><span>等待必要的同步点</span></div>

<figure class="note-visual"><figcaption><span>CUDA 数据流图</span>GPU 计算只是链路中的一段，内存位置和同步方式决定能否真正重叠工作。</figcaption><div class="note-map"><span><b>Host memory</b><small>CPU 地址空间中的普通内存，驱动复制前可能需要额外暂存。</small></span><span><b>Pinned memory</b><small>页锁定 Host 内存，适合异步传输，但数量过多会压缩系统可用内存。</small></span><span><b>Device memory</b><small>GPU 可直接访问的显存或设备内存，需要明确生命周期。</small></span><span><b>Stream</b><small>按序提交 CUDA 工作，不同 stream 是否并行取决于依赖和硬件。</small></span><span><b>Event</b><small>在 GPU 时间线上标记完成点，可用于测量和跨 stream 依赖。</small></span><span><b>同步</b><small>隐式同步会让 CPU 等 GPU，或让本可重叠的阶段串行。</small></span></div></figure>

## 普通内存与 Pinned Memory

CPU 使用 `malloc` 得到的通常是可分页内存。GPU 异步复制前，驱动可能先把数据搬到页锁定暂存区。Pinned Memory 不会被换出，可以直接参与 DMA，常用于高吞吐 Host-Device 传输。

```cpp
void *host_ptr = nullptr;
cudaMallocHost(&host_ptr, bytes);

void *device_ptr = nullptr;
cudaMalloc(&device_ptr, bytes);

cudaFree(device_ptr);
cudaFreeHost(host_ptr);
```

这段只展示生命周期。生产代码要检查每个返回值，并避免在每帧循环中反复分配。Pinned Memory 不是越多越好，锁住大量系统内存会影响其他进程和内核回收。

## Stream 是顺序队列

同一 stream 中的操作按提交顺序执行。不同 stream 可能重叠复制和计算，但前提是硬件支持、内存类型合适且没有隐式依赖。

```cpp
cudaStream_t stream;
cudaStreamCreate(&stream);
cudaMemcpyAsync(device_ptr, host_ptr, bytes, cudaMemcpyHostToDevice, stream);
kernel<<<grid, block, 0, stream>>>(device_ptr);
cudaStreamSynchronize(stream);
cudaStreamDestroy(stream);
```

最后的同步会等待该 stream 完成。若每个阶段都立即同步，异步 API 仍会退化成串行执行。更好的做法是只在输出真正被 CPU 使用或跨组件交接时建立依赖。

## 跑一个双 Stream 对照实验

下面的程序固定使用 Pinned Memory，先逐帧同步，再用两个 stream 和两组 buffer 交错提交同样的复制、kernel、复制任务。保存为 `cuda_stream_probe.cu`：

```cpp
#include <cuda_runtime.h>

#include <chrono>
#include <cstdio>
#include <cstdlib>

#define CUDA_OK(call)                                                         \
    do {                                                                      \
        cudaError_t error = (call);                                           \
        if (error != cudaSuccess) {                                           \
            std::fprintf(stderr, "%s:%d: %s\n", __FILE__, __LINE__,          \
                         cudaGetErrorString(error));                           \
            std::exit(1);                                                     \
        }                                                                     \
    } while (0)

__global__ void add_one(float* values, std::size_t count) {
    std::size_t index = blockIdx.x * blockDim.x + threadIdx.x;
    if (index < count) {
        values[index] += 1.0f;
    }
}

int main() {
    constexpr std::size_t count = 1 << 20;
    constexpr int iterations = 200;
    constexpr int threads = 256;
    const std::size_t bytes = count * sizeof(float);

    float* host[2] = {nullptr, nullptr};
    float* device[2] = {nullptr, nullptr};
    cudaStream_t streams[2];
    for (int slot = 0; slot < 2; ++slot) {
        CUDA_OK(cudaMallocHost(reinterpret_cast<void**>(&host[slot]), bytes));
        CUDA_OK(cudaMalloc(reinterpret_cast<void**>(&device[slot]), bytes));
        CUDA_OK(cudaStreamCreate(&streams[slot]));
        for (std::size_t index = 0; index < count; ++index) {
            host[slot][index] = static_cast<float>(index & 255);
        }
    }

    auto enqueue = [&](int slot) {
        CUDA_OK(cudaMemcpyAsync(device[slot], host[slot], bytes,
                                cudaMemcpyHostToDevice, streams[slot]));
        add_one<<<(count + threads - 1) / threads, threads, 0, streams[slot]>>>(
            device[slot], count);
        CUDA_OK(cudaGetLastError());
        CUDA_OK(cudaMemcpyAsync(host[slot], device[slot], bytes,
                                cudaMemcpyDeviceToHost, streams[slot]));
    };

    auto benchmark = [&](bool pipeline) {
        CUDA_OK(cudaDeviceSynchronize());
        auto begin = std::chrono::steady_clock::now();
        for (int frame = 0; frame < iterations; ++frame) {
            int slot = pipeline ? frame % 2 : 0;
            enqueue(slot);
            if (!pipeline) {
                CUDA_OK(cudaStreamSynchronize(streams[slot]));
            }
        }
        CUDA_OK(cudaDeviceSynchronize());
        auto end = std::chrono::steady_clock::now();
        return std::chrono::duration<double, std::milli>(end - begin).count();
    };

    double serial_ms = benchmark(false);
    double pipeline_ms = benchmark(true);
    std::printf("serial:   %.2f ms\n", serial_ms);
    std::printf("2-stream: %.2f ms\n", pipeline_ms);

    for (int slot = 0; slot < 2; ++slot) {
        CUDA_OK(cudaStreamDestroy(streams[slot]));
        CUDA_OK(cudaFree(device[slot]));
        CUDA_OK(cudaFreeHost(host[slot]));
    }
}
```

编译运行，并用 Nsight Systems 看时间线：

```bash
nvcc -O2 -std=c++17 cuda_stream_probe.cu -o cuda_stream_probe
./cuda_stream_probe
nsys profile --trace=cuda --sample=none -o cuda-stream ./cuda_stream_probe
```

这个对照不预设加速比例。GPU 没有并发复制引擎、数据块太小、kernel 太短或总线已经饱和时，双 stream 可能没有收益。先执行 `deviceQuery` 或读取 `cudaDeviceProp::asyncEngineCount`，再在 Nsight 时间线上确认 H2D、kernel 和 D2H 是否真的重叠。程序用 CPU 墙上时间测完整提交过程，适合比较两种调度；测单个 kernel 时仍应使用 event。

## Event 用来测 GPU 时间

CPU 墙上时间会混入线程调度和提交开销。CUDA event 在 GPU 时间线上记录位置，更适合测一段 stream 工作：

```cpp
cudaEvent_t start, stop;
cudaEventCreate(&start);
cudaEventCreate(&stop);
cudaEventRecord(start, stream);
kernel<<<grid, block, 0, stream>>>(device_ptr);
cudaEventRecord(stop, stream);
cudaEventSynchronize(stop);

float milliseconds = 0.0f;
cudaEventElapsedTime(&milliseconds, start, stop);
```

GPU 时间仍不等于机器人感知年龄。完整链路还要记录相机采集、预处理、排队和控制器消费时刻。

如果 CUDA 时间已经稳定，机器人仍然偶发“慢一拍”，下一步应检查[视觉伺服的端到端延迟预算](/2026/08/04/ai-robot-visual-servo-latency-budget/)和[ROS 2 Executor 的回调排队](/2026/02/17/ros2-executor-callback-groups-basics/)。GPU profile 只能解释 GPU 时间线，解释不了相机时间戳和订阅队列。

## TensorRT 为什么强调预分配

TensorRT engine、execution context、输入输出 buffer 和 stream 通常在启动阶段创建。每帧重新 `cudaMalloc`、创建 context 或同步默认 stream，会带来额外抖动。动态 shape 还可能触发不同的内存和 tactic 路径，需要单独测量。

```text
启动阶段：创建 engine/context/stream，分配 buffer，预热
稳态阶段：填充输入，异步复制，enqueue，消费输出
退出阶段：等待任务完成，按逆序释放资源
```

## 统一内存也要看访问模式

Unified Memory 简化地址管理，但页面迁移和首次访问可能产生不可预测开销。开发原型很方便，实时感知链路仍应记录迁移、缺页和预取行为。是否适合目标设备，要用 profile 和长时间负载验证。

## 参考资料

- [CUDA C++ Programming Guide](https://docs.nvidia.com/cuda/cuda-c-programming-guide/)
- [CUDA C++ Best Practices Guide](https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/)
- [NVIDIA TensorRT documentation](https://docs.nvidia.com/deeplearning/tensorrt/latest/)
- [NVIDIA Isaac ROS](https://nvidia-isaac-ros.github.io/)

**证据边界：**代码展示 CUDA 资源和 stream 的基本用法，没有针对具体 GPU、Jetson 或模型测量带宽和延迟。并发能力、统一内存行为和复制速度受硬件与驱动版本影响。
