---
title: "ROS 2 实时性优化：从毫秒级抖动到亚毫秒调度"
date: 2026-08-13 17:38:00
permalink: /2026/08/13/ros2-realtime-latency-optimization/
categories:
  - 技术
  - ROS 2
tags:
  - ROS 2
  - 实时系统
  - SCHED_FIFO
  - CPU 亲和性
  - ros2_tracing
description: 结合调度追踪、CPU 隔离、实时优先级和 DDS QoS，梳理 ROS 2 控制链路的延迟定位与优化方法。
---

## 证据边界

本文中的延迟、CPU 占用和控制精度数字来自工程案例稿，公开仓库没有提供相同硬件、RT 内核、LTTng trace 和完整基准脚本。读者应在自己的内核、DDS 实现与控制周期下重新测量，不能直接套用这些结果。

<div class="note-flow"><span>记录控制周期</span><i>→</i><span>追踪调度延迟</span><i>→</i><span>隔离实时 CPU</span><i>→</i><span>设置实时策略</span><i>→</i><span>复测最坏延迟</span></div>

<div class="note-map"><span><b>Trace</b><small>用 LTTng 与 eBPF 分析回调和唤醒延迟。</small></span><span><b>调度</b><small>SCHED_FIFO 需要权限、优先级与预算设计。</small></span><span><b>绑核</b><small>实时线程与 IRQ、日志和桌面任务分离。</small></span><span><b>内存</b><small>锁页和预分配减少缺页与运行时分配。</small></span><span><b>DDS</b><small>按控制语义选择 QoS，不能只追求吞吐。</small></span><span><b>验证</b><small>关注 P99 之外的最大延迟与超限次数。</small></span></div>

## 一、问题背景

在开发七轴协作机械臂的实时控制系统时，遇到了一个严重的性能问题：

**系统架构**：
```
任务规划器（Python）
    ↓ ROS 2 DDS
运动控制器（C++，1kHz控制频率）
    ↓
七轴机械臂
```

**故障现象**：
- 控制周期：1ms（1000Hz）
- **调度延迟抖动：±5ms**（最坏情况）
- 导致机械臂运动轨迹抖动
- 高速运动时控制精度下降40%

**日志片段**：
```
[WARN] Control loop overrun: expected 1.0ms, actual 6.2ms
[WARN] Control loop overrun: expected 1.0ms, actual 4.8ms
[INFO] Control loop: 1.1ms (OK)
[WARN] Control loop overrun: expected 1.0ms, actual 7.3ms
```

**客户反馈**：
> "机械臂装配精度不达标，高速运动时有明显卡顿"

---

## 二、问题定位（三步诊断法）

### 第一步：用 ros2_tracing 记录全链路

ROS 2 Humble 的 `ros2_tracing` 基于 LTTng。它能把 ROS 2 用户态事件与 Linux 调度事件放到同一条时间线上，但不同发行版和安装方式提供的事件集合可能不同，开始前应先用 `ros2 trace --list` 核对。

```bash
sudo apt install ros-humble-ros2trace babeltrace2

# 先启动控制器，再开始一个追踪会话；按 Ctrl-C 结束采集
ros2 launch robot_control control.launch.py
ros2 trace -s robot_control \
  -u ros2:rclcpp_publish ros2:rclcpp_callback_start ros2:rclcpp_callback_end \
  -k sched_switch sched_wakeup sched_wakeup_new

# 查看原始事件，进一步分析可使用 tracetools_analysis
babeltrace2 ~/.ros/tracing/robot_control
```

不要同时用 `ros2 run tracetools_trace trace` 和 `ros2 trace` 打开同名会话。Humble 也没有通用的 `ros2 trace convert perfetto` 子命令；若团队需要 Perfetto UI，应在项目中固定并验证独立的转换工具，而不是把它当作 ROS 2 默认流程。

---

**时间线分析**：

```
时间轴：
T0.0ms: /task_planner 发布 /joint_command
T0.1ms: DDS传输中...
T0.3ms: /motion_controller 收到消息
T0.3ms: 回调开始执行
T0.4ms: 回调执行中...
T0.4ms-T5.8ms: motion_controller 处于 off-CPU 区间
T5.8ms: CPU上正在运行 /usr/bin/update-notifier
T6.3ms: /motion_controller 重新调度
T6.5ms: 回调完成

实际耗时：6.2ms（预期1ms）
待解释区间：约5.4ms
```

**关键发现**：
- 发布到回调开始约 0.3ms，在这一次样本中不是最大区间
- 回调中出现约 5.4ms 的 off-CPU 区间，值得继续调查
- CPU 同期运行 `update-notifier` 只能说明现象，不能证明它以低优先级“抢占”了控制线程
- 应结合 `sched_switch.prev_state`、唤醒事件、目标 TID 的 runnable 状态及更高优先级任务，区分主动阻塞、锁等待、缺页和调度竞争

---

### 第二步：eBPF深度分析

**为什么需要 eBPF？**
- LTTng 时间线用于还原单次异常，eBPF 适合持续统计目标线程的唤醒到运行延迟
- 统计结果仍需和锁、IRQ、缺页及 ROS 2 回调事件交叉验证，不能单独宣告根因

**eBPF脚本**：
```python
#!/usr/bin/env bpftrace
# sched_latency.bt - 统计调度延迟

BEGIN {
    printf("Tracing scheduler latency... Hit Ctrl-C to end.\n");
}

BEGIN {
    if (!$1) {
        printf("usage: sudo bpftrace sched_latency.bt TARGET_TID\n");
        exit();
    }
}

tracepoint:sched:sched_wakeup,
tracepoint:sched:sched_wakeup_new
/$1 == args->pid && !@wakeup_time[args->pid]/
{
    @wakeup_time[args->pid] = nsecs;
}

tracepoint:sched:sched_switch
/$1 == args->next_pid && @wakeup_time[args->next_pid]/
{
    @motion_latency = hist((nsecs - @wakeup_time[args->next_pid]) / 1000);
    delete(@wakeup_time[args->next_pid]);
}

END {
    printf("\n=== Motion Controller Latency (us) ===\n");
    print(@motion_latency);
}
```

**运行eBPF**：
```bash
TARGET_TID=$(pgrep -f motion_controller | head -n1)
sudo bpftrace sched_latency.bt "$TARGET_TID"
# 运行10秒后Ctrl-C
```

脚本按目标 TID 过滤，而不是在 `sched_switch` 中误用当前线程名。直方图只能给出桶范围；精确 P99/P99.9 应保存原始样本后计算，并同时报告运行时长、样本数、负载和丢失事件。多线程执行器还要先确认真正运行控制回调的 TID。

---

### 第三步：CPU亲和性与优先级分析

**查看当前配置**：
```bash
# 查看motion_controller进程
ps -eLo pid,tid,class,rtprio,ni,comm | grep motion

# 输出：
PID    TID   CLS  RTPRIO  NI  COMMAND
12345  12345  TS    -      0  motion_control  ← TS = Time Sharing（非实时）
12345  12346  TS    -      0  motion_control
```

**发现问题**：
- ❌ 调度策略：TS（Time Sharing，非实时）
- ❌ 优先级：普通优先级
- ❌ CPU亲和性：未设置（可以在所有CPU上运行）

**CPU负载分析**：
```bash
# 查看CPU分配
top -H
# CPU0: motion_controller + system services
# CPU1: task_planner + background tasks
# CPU2: gnome-shell + GUI
# CPU3: update-notifier + cron

# 问题：实时任务和非实时任务混跑
```

---

## 三、优化方案（三板斧）

### 优化1：调度策略改为SCHED_FIFO

**原理**：
- `SCHED_OTHER`（TS）：普通时间片调度，可被抢占
- `SCHED_FIFO`：固定实时优先级策略；更高实时优先级线程仍可抢占它
- 线程若不阻塞、不让出且没有运行预算，可能饿死低优先级任务

**设置对象比 API 更重要**：
```cpp
#include <sched.h>

bool configure_current_thread(int priority) {
    sched_param param{};
    param.sched_priority = priority;
    return sched_setscheduler(0, SCHED_FIFO, &param) == 0;
}
```

`sched_setscheduler(0, ...)` 只修改调用线程。若 ROS 2 executor 工作线程执行控制回调，应在线程创建或进入控制循环后设置策略，并用 TID 核验；只在 node 构造函数调用通常只会修改构造它的线程。优先级也不能照搬 90，必须结合 IRQ、内核线程、watchdog、`RLIMIT_RTTIME` 与系统的 RT runtime 共同设计。

**授权实时权限**：优先在服务管理器中给单个服务授予最小权限，例如 systemd 的 `AmbientCapabilities=CAP_SYS_NICE` 与 `LimitRTPRIO=`。若使用 `@realtime` 组和 PAM limits，应通过配置管理写入一次并核对生效范围，不要反复向 `limits.conf` 追加规则。直接给通用二进制永久设置 capability 会扩大权限面。

**验证**：
```bash
ps -eLo pid,tid,class,rtprio,ni,comm | grep motion

# 输出：
PID    TID   CLS  RTPRIO  NI  COMMAND
12345  12345  FF    90     -   motion_control  ← FF = FIFO（实时）
```

---

### 优化2：CPU亲和性绑定

**原理**：
- 将实时任务绑定到专用CPU
- 避免与非实时任务竞争

**隔离 CPU 核心**：
```bash
# 查看 SMT/NUMA 拓扑，再选择 CPU
lscpu -e=CPU,CORE,SOCKET,NODE,ONLINE

# 示例：通过 systemd/cpuset 约束整个服务
systemctl set-property robot-control.service AllowedCPUs=2
```

`isolcpus=` 是遗留的启动参数，而且不会自动迁走 IRQ、内核线程和 timer。生产配置通常还要规划 housekeeping CPU、IRQ affinity，并避免把同一物理核的 SMT sibling 留给干扰任务。

**代码实现**：
```cpp
void set_cpu_affinity(int cpu_id) {
    cpu_set_t cpuset;
    CPU_ZERO(&cpuset);
    CPU_SET(cpu_id, &cpuset);

    pthread_t current_thread = pthread_self();
    if (pthread_setaffinity_np(current_thread,
                               sizeof(cpu_set_t), &cpuset) != 0) {
        RCLCPP_ERROR(get_logger(),
            "Failed to set CPU affinity to CPU %d", cpu_id);
    } else {
        RCLCPP_INFO(get_logger(),
            "Pinned to CPU %d", cpu_id);
    }
}

```

`pthread_setaffinity_np` 同样只绑定调用线程，不会自动绑定 executor 和 DDS 内部线程。应按 TID 检查 `/proc/PID/task/TID/status`，确认每一类线程的策略。

**ROS 2 Launch 文件配置**：
```python
# control.launch.py
from launch import LaunchDescription
from launch_ros.actions import Node

def generate_launch_description():
    return LaunchDescription([
        Node(
            package='robot_control',
            executable='motion_controller',
            name='motion_controller',
            output='screen',
            parameters=[{
                'use_realtime': True,
                'realtime_priority': 90,
                'cpu_affinity': 2,
            }]
        ),
    ])
```

Launch 参数只有在节点中声明并读取后才会生效。上面的参数是接口示意，并不会自动改变线程策略或亲和性；`PYTHONOPTIMIZE` 也不等于禁用 Python GC，且与这个 C++ 节点无关。

---

### 优化3：DDS QoS优化

**原则**：不存在适合所有实时场景的默认 QoS。状态流可以偏向“最新值”，不可丢失的离散命令则需要不同的失效安全设计。

**QoS配置**：
```cpp
// 订阅joint_command话题
auto qos = rclcpp::QoS(rclcpp::KeepLast(1))
    .reliability(RMW_QOS_POLICY_RELIABILITY_BEST_EFFORT)
    .durability(RMW_QOS_POLICY_DURABILITY_VOLATILE)       // 不持久化
    .deadline(std::chrono::milliseconds(2))                // 期望更新周期
    .liveliness(RMW_QOS_POLICY_LIVELINESS_AUTOMATIC)      // 自动检活
    .liveliness_lease_duration(std::chrono::milliseconds(100));

rclcpp::SubscriptionOptions options;
options.event_callbacks.deadline_callback =
    [this](rclcpp::QOSRequestedDeadlineMissedInfo& status) {
        RCLCPP_WARN(get_logger(),
            "Deadline missed! count=%d", status.total_count);
    };

subscription_ = create_subscription<JointCommand>(
    "/joint_command", qos,
    std::bind(&RealtimeControllerNode::command_callback, this, _1),
    options
);
```

`deadline=2ms` 表示期望相邻样本的更新间隔，并在违约时产生事件，不是单次传输的 2ms 超时。`BEST_EFFORT` 避免可靠传输的确认与重传机制，但不保证在每种网络和 RMW 上都更低延迟，能否接受丢样必须由控制语义决定。

**原理对比**：

| QoS参数 | 默认值 | 实时优化 | 原因 |
|---------|--------|---------|------|
| Reliability | RELIABLE | 按语义选择 | 状态流和命令流的容错要求不同 |
| History | KEEP_LAST(10) | KEEP_LAST(1) | 只关心最新值 |
| Deadline | 无 | 2ms | 监测期望更新周期 |
| Durability | VOLATILE | VOLATILE | 不向后加入者保留历史样本 |

---

## 四、性能对比

### 测试环境

**硬件**：
- CPU: Intel i7-10700 (8核16线程)
- RAM: 32GB DDR4
- OS: Ubuntu 22.04 + RT Patch

**软件**：
- ROS 2 Humble
- DDS: CycloneDDS (低延迟优化)

---

### 延迟分布对比

案例稿曾给出 P99 和最坏延迟的前后对比，但没有附原始 trace 与完整脚本，因此这里只保留测量设计，不把数字当作公开 benchmark。简单循环调用 `spin_some()` 只测 executor 调用耗时，既没有 1kHz 节拍，也不等于端到端消息延迟、调度唤醒延迟或控制周期误差。

正式验证应分别记录：

| 测量对象 | 起点 | 终点 | 关键补充条件 |
|----------|------|------|--------------|
| 端到端延迟 | 发布端单调时钟时间戳 | 订阅回调读取时间戳 | 时钟同步、序号、消息大小、RMW |
| 唤醒延迟 | 期望唤醒时刻 | 线程真正运行时刻 | CPU、策略、IRQ与系统负载 |
| 控制周期误差 | 绝对周期 deadline | 每次循环开始时间 | 超限次数、连续超限、最大值 |
| 执行时间 | 控制计算开始 | 控制计算结束 | warm-up、内存分配和日志开销 |

报告 P50/P99/P99.9/Max 时还要给出样本数、测试时长、压力负载、时钟来源与原始数据生成方法。

---

### CPU 与线程配置核验

绑核可以减少迁移和共享资源干扰，但不会自然降低算法的 CPU 时间。用 `top -H` 观察每个线程，再逐个读取 `/proc/PID/task/TID/status` 的 `Cpus_allowed_list`；同时检查 executor、DDS、IRQ 和 housekeeping 线程，而不是只对进程主 TID 执行一次 `taskset -p`。

---

## 五、验证与监控

### 实时性验证工具

**cyclictest** 用于测量内核定时唤醒基线，不验证 ROS 2 控制链路：
```bash
sudo apt install rt-tests

cyclictest --help  # 先核对当前 rt-tests 版本参数
sudo cyclictest -p 80 -t1 -i 1000 -l 100000 -a 2
```

应在与生产相同的 CPU、RT 内核、频率策略、IRQ 布局和压力负载下运行，并将结果与 ROS 2 端到端和控制周期测试分开报告。

---

### 运行时监控

实时线程内不要直接调用可能加锁或分配内存的 Prometheus Histogram，也不要在每次超限时同步写日志。控制线程只更新预分配计数器或无锁环形缓冲，由非实时线程批量导出到 Prometheus/Grafana。
```cpp
class RealtimeControllerNode : public rclcpp::Node {
private:
    RealtimeSampleRing& rt_samples_;

    void control_loop() {
        auto start = std::chrono::steady_clock::now();

        compute_control_command();

        auto duration = std::chrono::duration_cast<std::chrono::microseconds>(
            std::chrono::steady_clock::now() - start).count();

        rt_samples_.try_push(duration);  // 必须是预分配且经验证的非阻塞路径
    }
};
```

**Grafana Dashboard**：
- 实时延迟曲线（P50/P99/Max）
- 超时次数统计
- CPU占用率
- 告警：P99延迟>200us

---

## 六、经验总结

### 实时优化主线

1. **先测量**：拆分回调执行、唤醒、通信和控制周期误差
2. **再配置**：按线程设置调度、CPU 与内存策略，并规划 IRQ/housekeeping
3. **按语义选 QoS**：最新状态、离散命令和安全心跳不能套用同一组合

### 常见坑点

**坑1：忘记授权实时权限**
```bash
# 症状：sched_setscheduler返回-1
# 核对服务的权限上限和 capability
systemctl show robot-control.service -p LimitRTPRIO -p AmbientCapabilities
```

**坑2：CPU隔离后系统卡顿**
```bash
# 同时检查任务、IRQ、内核线程和 SMT sibling 的 CPU 分配
lscpu -e=CPU,CORE,SOCKET,NODE,ONLINE
```

**坑3：DDS可靠性丢消息**
```cpp
// Deadline 能发现更新周期违约，但不能识别每个丢失样本
qos.deadline(std::chrono::milliseconds(2));
```

---

### Trade-off分析

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| SCHED_FIFO | 减少普通任务干扰 | 配置不当会饿死其他任务 | 经预算的关键线程 |
| CPU约束 | 减少迁移和部分竞争 | 仍需处理IRQ、SMT和共享缓存 | 关键任务 |
| BEST_EFFORT | 避免可靠协议等待 | 允许丢样且不保证更低延迟 | 可容忍丢失的最新状态 |
| RELIABLE | 提供可靠传输机制 | 可能产生排队、确认和重传 | 需结合超时与幂等设计的命令 |

---

## 七、进阶优化

### 1. 内存预分配（避免缺页中断）

在进入实时循环前检查 `RLIMIT_MEMLOCK` 和 `mlockall(MCL_CURRENT | MCL_FUTURE)` 返回值，完成所需堆内存与线程栈配置并预触页。线程栈大小应在线程创建属性中设置，不要靠 8MB 局部数组“预分配栈”，这可能被优化掉或直接造成栈溢出。

---

### 2. Loaned message（条件相关的拷贝优化）

```cpp
auto qos = rclcpp::QoS(1)
    .reliability(RMW_QOS_POLICY_RELIABILITY_BEST_EFFORT)
    .history(RMW_QOS_POLICY_HISTORY_KEEP_LAST);

// 使用前检查 RMW 与消息类型是否支持 loan
auto loaned_msg = publisher_->borrow_loaned_message();
loaned_msg.get().data = compute_control_command();
publisher_->publish(std::move(loaned_msg));
```

Loaned message 是否减少拷贝取决于 RMW、消息类型和通信路径，不等于端到端共享内存零拷贝。应先核验 middleware 的 loan 支持，并用 trace 比较实际路径。

---

### 3. PREEMPT_RT 内核

PREEMPT_RT 可以改善内核可抢占性，但不是单独的“终极方案”，也不能保证固定的最坏延迟。安装方式取决于发行版；Ubuntu 22.04 应遵循 Ubuntu Real-time 文档，不要照搬 Debian 的 `linux-image-rt-amd64` 包名。安装后用 `uname -a`、内核配置与负载下的 `cyclictest` 共同核验。

---

## 八、总结

ROS 2 实时性优化不是固定的“三板斧”，而是一条可复核的证据链：先用 LTTng 和调度事件拆分延迟，再按目标线程配置调度、CPU、内存和 IRQ，最后按数据语义选择 QoS，并在生产等价负载下复测。案例稿中的性能数字尚无公开原始数据，不能作为可复现结论。

---

## 参考资料

- [ROS 2 tracing（Humble）](https://github.com/ros2/ros2_tracing/tree/humble)
- [ROS 2 实时编程演示](https://docs.ros.org/en/humble/Tutorials/Demos/Real-Time-Programming.html)
- [ROS 2 QoS 设置](https://docs.ros.org/en/humble/Concepts/Intermediate/About-Quality-of-Service-Settings.html)
- [Linux SCHED_FIFO 语义](https://man7.org/linux/man-pages/man7/sched.7.html)
- [Ubuntu Real-time 文档](https://documentation.ubuntu.com/real-time/)
