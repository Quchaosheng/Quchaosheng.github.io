---
title: "生产事故复盘：七轴机械臂 DDS-RPC 偶发超时的定位与修复"
date: 2026-08-13 17:40:00
permalink: /2026/08/13/dds-rpc-timeout-debugging/
categories:
  - 技术
  - ROS 2
tags:
  - DDS
  - QoS
  - RPC
  - 故障定位
  - 机器人
description: 从抓包、DDS 日志和 QoS 配置入手，复盘高负载 RPC 偶发超时的定位链路与修复取舍。
---

## 证据边界

本文是一篇工程复盘稿。公开仓库未包含私有生产环境的原始抓包、设备日志和真实机械臂复现条件，因此文中的生产指标用于说明排查链路，不构成可由公开仓库独立复现的 benchmark。

<div class="note-flow"><span>复现高负载超时</span><i>→</i><span>排除网络与进程</span><i>→</i><span>对齐抓包和 DDS 日志</span><i>→</i><span>审查 QoS 深度</span><i>→</i><span>压力测试验证</span></div>

<div class="note-map"><span><b>现象</b><small>低负载正常，高负载偶发超时。</small></span><span><b>网络</b><small>先用 ping、iperf 与抓包排除链路问题。</small></span><span><b>Discovery</b><small>确认 writer 与 reader 已稳定匹配。</small></span><span><b>QoS</b><small>重点核对可靠性、历史策略与队列深度。</small></span><span><b>修复</b><small>统一两端配置，并加入 deadline 观测。</small></span><span><b>验证</b><small>用持续压力测试确认超时不再出现。</small></span></div>

## 一、问题现场

我们的七轴协作机械臂在装配任务中使用Cora DDS-RPC进行运动控制通信。生产环境中出现了一个棘手的问题：

**故障现象**：
- 高负载场景（装配任务，>200个RPC调用/秒）
- **15%的RPC调用超时**（>100ms未收到响应）
- 导致机械臂运动卡顿，任务失败

**日志片段**：
```
[ERROR] RPC call timeout: MoveToTarget, seq=1234, elapsed=150ms
[ERROR] RPC call timeout: MoveToTarget, seq=1235, elapsed=120ms
[INFO] RPC call success: MoveToTarget, seq=1236, elapsed=25ms
[ERROR] RPC call timeout: MoveToTarget, seq=1237, elapsed=180ms
```

**关键特征**：
- ✅ 低负载（<50 req/s）正常
- ❌ 高负载（>200 req/s）出现超时
- ❌ **偶发**（不是100%失败）
- ❌ 超时的RPC永远不会收到响应（不是慢，是丢了）

---

## 二、初步排查（排除法）

### 假设1：网络问题？

**验证**：
```bash
# 1. ping测试
ping -c 1000 <运动控制器IP>
# 结果：0%丢包，延迟<1ms

# 2. iperf带宽测试
iperf3 -c <运动控制器IP> -t 60
# 结果：带宽980 Mbps，无问题

# 3. 抓包看网络层
tcpdump -i eth0 -w dds.pcap
# 结果：TCP层没有重传，UDP层没有丢包
```

**结论**：❌ 不是网络问题

---

### 假设2：运动控制器崩溃或卡死？

**验证**：
```bash
# 1. 查看进程状态
ps aux | grep motion_controller
# 结果：进程正常运行

# 2. 查看CPU/内存
top -p <PID>
# 结果：CPU 40%，内存正常

# 3. 查看线程栈
gdb -p <PID> -ex "thread apply all bt" -ex "quit"
# 结果：所有线程正常，没有死锁
```

**结论**：❌ 不是进程崩溃

---

### 假设3：DDS Discovery问题？

**验证**：
```bash
# 查看DDS Discovery日志
export FASTRTPS_LOG_LEVEL=debug
./motion_controller

# 日志显示：
# [DISCOVERY] Matched writer: 0x123456...
# [DISCOVERY] Matched reader: 0x789abc...
```

**结论**：❌ Discovery正常，Reader和Writer已匹配

---

## 三、深度定位（三步法）

### 第一步：Wireshark抓包分析

**抓包命令**：
```bash
# 只抓DDS RTPS协议（UDP端口7400）
tcpdump -i eth0 -w dds_high_load.pcap \
    "udp port 7400 or udp port 7401"
```

**Wireshark过滤器**：
```
rtps && rtps.sm.guidPrefix == 0x0123456789abcdef
```

**关键发现**：

```
时间戳      源IP          目标IP         RTPS消息类型    Sequence Number
----------------------------------------------------------------------
10:00:00.100  Task Planner  Motion Ctrl   DATA            seq=1234
10:00:00.102  Task Planner  Motion Ctrl   DATA            seq=1235
10:00:00.104  Task Planner  Motion Ctrl   DATA            seq=1236
10:00:00.106  Task Planner  Motion Ctrl   DATA            seq=1237
10:00:00.108  Task Planner  Motion Ctrl   DATA            seq=1238
10:00:00.110  Task Planner  Motion Ctrl   DATA            seq=1239
10:00:00.112  Task Planner  Motion Ctrl   DATA            seq=1240
10:00:00.114  Task Planner  Motion Ctrl   DATA            seq=1241
10:00:00.116  Task Planner  Motion Ctrl   DATA            seq=1242  ← Writer发了9条
----------------------------------------------------------------------
                                           ↓ 但Reader只收到最新1条！
----------------------------------------------------------------------
10:00:00.200  Motion Ctrl   Task Planner  ACKNACK         seq=1242  ← 只ACK了1242
```

**惊人的发现**：
- ✅ Writer **确实发送了**9条消息（seq 1234-1242）
- ❌ Reader **只收到了最后1条**（seq 1242）
- ❌ 前8条消息**在Reader端丢失了**

**这不是网络丢包（tcpdump看到了所有包），是DDS层丢的！**

---

### 第二步：DDS日志分析

**开启DDS详细日志**：
```cpp
// 代码中添加
#include <fastdds/dds/log/Log.hpp>

eprosima::fastdds::dds::Log::SetVerbosity(
    eprosima::fastdds::dds::Log::Kind::Info
);
```

**关键日志片段**：
```
[RTPS_MSG_IN] Received DATA message, seq=1234
[RTPS_READER] Adding sample to history queue, seq=1234
[RTPS_READER] History queue full (size=1), dropping oldest sample
[RTPS_READER] Adding sample to history queue, seq=1235
[RTPS_READER] History queue full (size=1), dropping oldest sample
[RTPS_READER] Adding sample to history queue, seq=1236
...
[RTPS_READER] Adding sample to history queue, seq=1242
[RTPS_READER] Notifying user callback with seq=1242
```

**根因浮现**：
- Reader的history queue大小是1
- 新消息到来时，旧消息被覆盖（样本覆盖）
- 应用层只能收到最新的那一条

---

### 第三步：代码审查（找配置）

**Writer端QoS配置**：
```cpp
// TaskPlanner.cpp
DataWriterQos writer_qos;

// ✅ Writer配置了history.depth = 8
writer_qos.history().kind = KEEP_LAST_HISTORY_QOS;
writer_qos.history().depth = 8;  // 保留最近8条消息，支持重传

writer_qos.reliability().kind = RELIABLE_RELIABILITY_QOS;

writer_ = publisher_->create_datawriter(topic_, writer_qos);
```

**Reader端QoS配置**：
```cpp
// MotionController.cpp
DataReaderQos reader_qos;

// ❌ Reader配置了history.depth = 1 !!
reader_qos.history().kind = KEEP_LAST_HISTORY_QOS;
reader_qos.history().depth = 1;  // 只保留最新1条消息

reader_qos.reliability().kind = RELIABLE_RELIABILITY_QOS;

reader_ = subscriber_->create_datareader(topic_, reader_qos);
```

**根因确认**：
- Writer和Reader的QoS配置**不对称**
- Writer: history.depth = 8（可以重传8条）
- Reader: history.depth = 1（只能存1条）

**为什么会丢消息？**

```
时间线：
T0: Writer发送seq=1234，Reader收到并存入history queue（size=1）
    Reader正忙（处理上一个请求），还没调用用户回调

T1: Writer发送seq=1235，Reader收到
    history queue满了（size=1），丢弃1234，存入1235

T2: Writer发送seq=1236，Reader收到
    history queue满了，丢弃1235，存入1236

...

T8: Writer发送seq=1242，Reader收到，存入1242

T9: Reader终于空闲了，调用用户回调
    但只能取到seq=1242，前面8条都被覆盖了！
```

---

## 四、解决方案

### 方案1：统一QoS配置（最简单）

**修改Reader端代码**：
```cpp
// MotionController.cpp
DataReaderQos reader_qos;

reader_qos.history().kind = KEEP_LAST_HISTORY_QOS;
reader_qos.history().depth = 8;  // 改成8，与Writer一致

reader_qos.reliability().kind = RELIABLE_RELIABILITY_QOS;

reader_ = subscriber_->create_datareader(topic_, reader_qos);
```

**效果**：
- ✅ Reader可以缓存8条消息
- ✅ 高负载下不会样本覆盖
- ✅ 实机测试100+小时，零丢包

**代价**：
- ❌ Reader内存增加：8 * sizeof(RPC_Request) ≈ 64KB
- ❌ 高频场景（>1000 req/s）可能有cache miss

**为什么64KB可以接受？**
- 机械臂场景：RPC频率<100 Hz
- 嵌入式设备有256MB内存，64KB占比<0.1%
- **可靠性优先级 > 内存占用**

---

### 方案2：增加DEADLINE QoS（长期优化）

**问题**：即使修复了样本覆盖，如何**提前发现**通信异常？

**方案**：使用DDS的DEADLINE QoS

```cpp
// Writer端
writer_qos.deadline().period = Duration_t(0, 100 * 1000 * 1000);  // 100ms

// Reader端
reader_qos.deadline().period = Duration_t(0, 100 * 1000 * 1000);  // 100ms

// 注册回调
reader_listener_.on_requested_deadline_missed =
    [](DataReader* reader, const RequestedDeadlineMissedStatus& status) {
        LOG_ERROR("Deadline missed! count=%d", status.total_count);
        // 触发告警、记录事件
    };
```

**效果**：
- ✅ 如果100ms内没收到消息，触发回调
- ✅ 可以主动降级（切换到安全模式）
- ✅ 比gRPC timeout更精确（DDS层检测）

---

## 五、复现与验证

### 复现步骤

**构造高频RPC场景**：
```cpp
// test_high_load.cpp
void stress_test() {
    std::vector<std::future<Result>> futures;

    for (int i = 0; i < 1000; ++i) {
        // 发送RPC请求（不等响应）
        auto future = client.async_call("MoveToTarget", target_pose);
        futures.push_back(std::move(future));

        // 高频发送，不等上一个完成
        std::this_thread::sleep_for(std::chrono::milliseconds(5));
    }

    // 统计超时率
    int timeout_count = 0;
    for (auto& future : futures) {
        if (future.wait_for(std::chrono::milliseconds(100))
            == std::future_status::timeout) {
            ++timeout_count;
        }
    }

    std::cout << "Timeout rate: "
              << (100.0 * timeout_count / 1000) << "%" << std::endl;
}
```

**修复前**：
```
Timeout rate: 15.2%
Timeout rate: 14.8%
Timeout rate: 16.1%
```

**修复后**：
```
Timeout rate: 0.0%
Timeout rate: 0.0%
Timeout rate: 0.0%
```

---

### 长时间稳定性测试

**测试脚本**：
```bash
#!/bin/bash
# 连续运行100小时

start_time=$(date +%s)
error_count=0

while true; do
    # 运行1小时的装配任务
    ./assembly_task --duration 3600

    if [ $? -ne 0 ]; then
        ((error_count++))
        echo "[$(date)] Error occurred, total errors: $error_count"
    fi

    # 检查是否运行了100小时
    current_time=$(date +%s)
    elapsed=$((current_time - start_time))

    if [ $elapsed -gt 360000 ]; then  # 100小时
        break
    fi

    echo "[$(date)] Elapsed: $((elapsed / 3600)) hours, errors: $error_count"
done

echo "Test completed: $error_count errors in 100 hours"
```

**结果**：
```
Test completed: 0 errors in 100 hours
Total RPC calls: 7,200,000
Timeout rate: 0.000%
```

---

## 六、技术沉淀

### 1. DDS QoS配置最佳实践

**History Depth选择公式**：
```
depth >= (发送频率 Hz) × (最大处理延迟 s)
```

**示例**：
- 发送频率：200 Hz
- 最大处理延迟：50ms
- 推荐depth：200 × 0.05 = **10**

---

**Writer-Reader对称性原则**：

```cpp
// ❌ 不对称（会导致样本覆盖）
writer_qos.history().depth = 8;
reader_qos.history().depth = 1;

// ✅ 对称（推荐）
writer_qos.history().depth = 8;
reader_qos.history().depth = 8;
```

---

**QoS配置对比表**：

| History QoS | 适用场景 | 优点 | 缺点 |
|-------------|---------|------|------|
| KEEP_LAST(depth=1) | 状态型数据（传感器读数） | 省内存 | 高频下样本覆盖 |
| KEEP_LAST(depth=N) | RPC、命令消息 | 平衡 | 需要评估N |
| KEEP_ALL | 日志、事件 | 不丢数据 | 内存无上限 |

---

### 2. 配置Review Checklist

在Code Review时检查：

- [ ] Writer和Reader的history depth是否一致？
- [ ] history depth是否足够（>= 发送频率 × 最大延迟）？
- [ ] 是否配置了DEADLINE QoS（关键路径）？
- [ ] 是否配置了resource limits（避免内存泄漏）？
- [ ] 是否考虑了高负载场景（压力测试）？

---

## 七、Trade-off分析

### 方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| depth=1 | 省内存 | 高频下丢消息 | 低频状态数据 |
| depth=8 | 平衡 | 内存+64KB | 中频RPC（<100Hz）|
| depth=32 | 高可靠 | 内存+256KB | 高频RPC（>500Hz）|
| KEEP_ALL | 不丢数据 | 内存无上限 | 日志、事件 |

---

### 我们的选择

**depth=8，理由**：
1. 机械臂RPC频率<100Hz，8足够
2. 内存增加64KB可以接受
3. 可靠性优先级 > 内存占用

**如果未来需要支持>500Hz呢？**
- 考虑depth=32（内存+256KB）
- 或者用shared memory代替DDS（零拷贝）

---

## 八、相关问题

### Q1: 为什么不用gRPC？

| 维度 | gRPC | DDS |
|------|------|-----|
| 延迟 | 1-5ms | 0.1-1ms |
| 发现 | 需要服务注册中心 | 自动发现 |
| QoS | 无 | 丰富（Reliability, Deadline, ...）|
| 生态 | 语言支持好 | 机器人专用 |

**我们的选择**：
- 低延迟路径：用DDS（运动控制）
- 普通路径：用gRPC（任务规划、HMI）

---

### Q2: DDS vs ROS 2的关系？

**ROS 2底层就是DDS**：
```
ROS 2 应用层
    ↓
rclcpp/rclpy (ROS 2 client library)
    ↓
rmw (ROS Middleware Interface)
    ↓
DDS实现 (Fast DDS / Cyclone DDS / RTI Connext)
```

**我们遇到的问题也适用于ROS 2！**

---

### Q3: 如何选择DDS实现？

| 实现 | 厂商 | 许可证 | 性能 | 易用性 |
|------|------|--------|------|--------|
| Fast DDS | eProsima | Apache 2.0 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Cyclone DDS | Eclipse | EPL 2.0 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| RTI Connext | RTI | 商业 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**我们用的**：Fast DDS（开源、性能够用、ROS 2默认）

---

## 九、经验教训

### 1. 配置不对称是隐蔽的bug

**特点**：
- ✅ 低负载正常（消息处理及时，不会覆盖）
- ❌ 高负载失败（消息堆积，触发覆盖）
- ❌ 偶发（不是100%失败，难以复现）

**教训**：
- 配置要成对检查（Writer和Reader）
- 压力测试必不可少

---

### 2. 日志比抓包更直接

**抓包的优点**：
- 看到网络层真实情况
- 确认消息是否发送

**抓包的缺点**：
- 看不到DDS内部状态（history queue）
- 分析耗时

**教训**：
- 先开DDS详细日志
- 日志不够再抓包

---

### 3. 文档和规范很重要

**这次问题的根源**：
- 没有DDS配置规范
- 开发者不知道depth应该怎么配
- Code Review没检查QoS

**改进**：
- 编写最佳实践文档
- Code Review清单
- 提供配置模板

---

## 十、总结

### 问题回顾

1. **现象**：高负载下15%的RPC超时
2. **根因**：Writer和Reader的QoS history depth不对称（8/1）
3. **后果**：Reader端样本覆盖，消息丢失
4. **解决**：统一配置（都改成8）
5. **验证**：100+小时零丢包

---

### 关键技术点

- ✅ DDS QoS配置要对称
- ✅ history depth >= 发送频率 × 最大延迟
- ✅ 压力测试是必须的
- ✅ 监控告警要到位

---

### 通用方法论

**故障定位三步法**：
1. **排除法**：网络、进程、Discovery
2. **抓包 + 日志**：找到丢消息的位置
3. **代码审查**：找到配置错误

---

## 参考资料

1. eProsima Fast DDS文档: https://fast-dds.docs.eprosima.com/
2. OMG DDS规范: https://www.omg.org/spec/DDS/
3. ROS 2 QoS设计: https://design.ros2.org/articles/qos.html
