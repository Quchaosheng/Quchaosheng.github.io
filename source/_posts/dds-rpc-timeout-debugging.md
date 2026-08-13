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

<div class="note-map"><span><b>现象</b><small>低负载正常，高负载偶发超时。</small></span><span><b>网络</b><small>在发送端和接收端同时抓包，并检查接口丢包计数。</small></span><span><b>Discovery</b><small>确认端点匹配，但不把“已匹配”当成交付证明。</small></span><span><b>QoS</b><small>分别核对兼容性、历史缓存、资源上限和应用取样速度。</small></span><span><b>超时</b><small>RPC 用请求 ID 和单调时钟定案，Deadline 只做周期健康观测。</small></span><span><b>验证</b><small>用突发、持续压力和故障注入覆盖最坏积压。</small></span></div>

## 一、问题现场

这个案例中的运动控制通信使用一层业务 DDS-RPC 封装。为了避免把私有组件名称误写成通用产品，下面只讨论可迁移的 DDS、RTPS 和应用层行为。

**故障现象**：
- 高负载场景（装配任务，>200个RPC调用/秒）
- 案例记录中约 **15% 的 RPC 调用超过 100 ms 未收到响应**
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
- ❌ 部分请求最终没有被业务层观察到响应；仅凭调用方超时，还不能先验判断是网络丢包、DDS 缓存淘汰、应用未及时 `take()`，还是响应关联逻辑出错

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

# 3. 发送端与接收端同时抓 RTPS，并记录网卡/内核计数
tcpdump -i eth0 -w sender.pcap udp portrange 7400-7500
ip -s link show eth0
ethtool -S eth0
```

**边界**：`ping` 和 `iperf` 只能说明对应测试流量正常，不能证明 DDS 使用的 UDP 流量没有丢失。只有把发送端抓包、接收端抓包、网卡/内核丢包计数和 RTPS 序号对齐，才能把故障范围缩小到网络之前或网络之后。

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

**结论**：端点已经匹配，因此可以继续检查数据路径；但 Discovery 正常并不代表后续每个样本都被可靠交付或被应用取走。

---

## 三、深度定位（三步法）

### 第一步：Wireshark抓包分析

**抓包命令**：
```bash
# 端口与 domain ID、participant index 和 DDS 实现有关；以下范围仅作示例
tcpdump -i eth0 -w dds_high_load.pcap \
    "udp portrange 7400-7500"
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
10:00:00.200  Motion Ctrl   Task Planner  ACKNACK         ...
```

这里能确认发送端发出了序号连续的 RTPS DATA。还需要在接收端抓包，或用 DDS/RTPS 日志确认这些 DATA 是否进入 reader history。RTPS `ACKNACK` 携带的是接收状态集合，不能简化成“只 ACK 某一个业务序号”。

当接收端抓包也看到全部 DATA，而应用层只 `take()` 到最后一个样本时，排查重点才应转向 reader history、resource limits、应用取样线程和请求关联逻辑。

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

**示意日志**（字段名随 DDS 实现和日志级别变化，不能当作 Fast DDS 固定输出格式）：
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

**由日志可验证的事实**：
- 多个请求写入同一个未键控 topic instance；
- Reader 使用 `KEEP_LAST(depth=1)`；
- 应用取样速度低于突发到达速度；
- 新样本进入 history 时，未取走的旧样本被淘汰。

`RELIABLE` 约束的是 DDS writer 与 reader 之间的可靠交付行为，不等于应用一定处理每个历史样本。如果 history/resource limits 允许旧样本被替换，或者应用没有及时 `take()`，业务层仍可能看不到所有请求。

---

### 第三步：代码审查（找配置）

**Writer端QoS配置**：
```cpp
// TaskPlanner.cpp
DataWriterQos writer_qos;

// Writer 保留最近 8 个样本，供可靠传输与未确认样本管理使用
writer_qos.history().kind = KEEP_LAST_HISTORY_QOS;
writer_qos.history().depth = 8;

writer_qos.reliability().kind = RELIABLE_RELIABILITY_QOS;

writer_ = publisher_->create_datawriter(topic_, writer_qos);
```

**Reader端QoS配置**：
```cpp
// MotionController.cpp
DataReaderQos reader_qos;

// Reader 只保留最近 1 个未取走样本；这对“最新状态”合理，
// 但对每个请求都必须处理的 RPC request stream 风险很高
reader_qos.history().kind = KEEP_LAST_HISTORY_QOS;
reader_qos.history().depth = 1;

reader_qos.reliability().kind = RELIABLE_RELIABILITY_QOS;

reader_ = subscriber_->create_datareader(topic_, reader_qos);
```

**根因确认**：
- Writer 与 Reader 的 history depth **不要求协议层必须相等**；depth 也不是 DDS 端点匹配的 Request/Offered 兼容条件；
- 真正的问题是 Reader 的 `KEEP_LAST(depth=1)` 与业务语义不匹配：多个未键控 RPC 请求共享一个 instance，而应用可能来不及取样；
- Writer depth、Reader depth、resource limits 和应用消费速度必须分别覆盖各自的最坏积压，不能靠“配置成相同数字”代替容量分析。

**为什么会丢消息？**

```
时间线：
T0: Writer发送seq=1234，Reader收到并存入history queue（size=1）
    Reader正忙（处理上一个请求），还没调用用户回调

T1: Writer发送seq=1235，Reader收到
    在本案例的KEEP_LAST/resource-limit配置下，1234尚未被应用取走，
    新样本使旧样本从reader history中被淘汰

T2: Writer发送seq=1236，Reader收到
    history queue满了，丢弃1235，存入1236

...

T8: Writer发送seq=1242，Reader收到，存入1242

T9: 应用线程终于执行take()
    只能取得仍留在history中的最新样本；前面的请求已经无法被业务层处理
```

---

## 四、解决方案

### 方案1：按最坏积压扩大 Reader 容量

**修改Reader端代码**：
```cpp
// MotionController.cpp
DataReaderQos reader_qos;

reader_qos.history().kind = KEEP_LAST_HISTORY_QOS;
reader_qos.history().depth = 8;  // 示例值：必须由突发量和消费延迟验证

reader_qos.reliability().kind = RELIABLE_RELIABILITY_QOS;

reader_ = subscriber_->create_datareader(topic_, reader_qos);
```

还应显式设置并检查 `resource_limits`，确保 `max_samples`、`max_samples_per_instance` 等上限不小于 history 需要的容量。不同 Fast DDS 版本的 API 与默认值可能不同，配置时应以所用版本文档为准。

**案例观察**：
- Reader 可以同时保留更多未取走请求；
- 在案例压力模型下，业务层不再观察到原先的样本淘汰；
- 原稿记录了 100 小时稳定运行，但原始日志没有公开，因此这里只把它作为案例观察，不写成可复现的“零丢包”证明。

**代价**：
- ❌ Reader内存增加：8 * sizeof(RPC_Request) ≈ 64KB
- ❌ 高频场景（>1000 req/s）可能有cache miss

**为什么64KB可以接受？**
- 机械臂场景：RPC频率<100 Hz
- 嵌入式设备有256MB内存，64KB占比<0.1%
- **可靠性优先级 > 内存占用**

---

### 方案2：用 Deadline 监控周期健康，用请求截止时间定案 RPC

**问题**：即使修复了 history 淘汰，如何发现周期性数据流中断，并给每个 RPC 设置明确的完成边界？

`Deadline` 表达的是“同一 instance 的样本更新间隔期望”。它适合监控周期性控制流或心跳是否按约定刷新，但它不是单个 RPC request/response 的超时器。RPC 仍应携带 request ID，并在客户端用单调时钟维护每个请求的 deadline、取消与迟到响应策略。

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

**效果与边界**：
- 周期性 instance 超过约定更新间隔时，可通过 requested/offered deadline missed 状态观测；
- 是否切换安全模式必须由上层安全策略决定，不能在通用 listener 中直接等同于急停；
- 对单个 RPC，仍以请求 ID 对应的应用层 deadline 和实际 response/result 为准。

---

## 五、复现与验证

### 复现步骤

**构造高频 RPC 场景**（以下是业务封装接口示意，不是可直接编译的 Fast DDS API）：
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

**History Depth容量估算起点**：
```
reader_depth >= ceil(峰值到达率 × 最坏未取样时间) + 突发余量
```

这只是容量估算起点，不是 DDS 规范公式。还要考虑 topic 是否 keyed、每个 instance 的独立历史、应用一次 `take()` 的批量、writer 未确认样本上限，以及 `resource_limits`。

**示例**：
- 发送频率：200 Hz
- 最大处理延迟：50ms
- 推荐depth：200 × 0.05 = **10**

---

**Writer 与 Reader 分开预算**：

```cpp
// 数字不同本身不构成错误；错误在于任一侧容量小于自己的最坏积压
writer_qos.history().depth = 8;
reader_qos.history().depth = 1;

// 示例：两端按各自职责独立预算
writer_qos.history().depth = writer_backlog_budget;
reader_qos.history().depth = reader_backlog_budget;
```

---

**QoS配置对比表**：

| History QoS | 适用场景 | 优点 | 缺点 |
|-------------|---------|------|------|
| KEEP_LAST(depth=1) | 只关心最新值的状态流 | 省内存、旧状态自然淘汰 | 不适合每个样本都必须处理的请求流 |
| KEEP_LAST(depth=N) | 有界积压的请求、命令或遥测 | 内存有界 | N 必须覆盖突发与最坏消费延迟 |
| KEEP_ALL | 需要保留全部样本且能施加背压的场景 | 不因 history depth 淘汰旧样本 | 仍受 resource limits 限制 |

---

### 2. 配置Review Checklist

在Code Review时检查：

- [ ] Reliability、Durability、Deadline 等 Request/Offered QoS 是否兼容？
- [ ] Writer 未确认窗口和 Reader 未取样窗口是否分别完成容量预算？
- [ ] History 与 resource limits 是否一致，满载时是阻塞、失败还是淘汰？
- [ ] 应用是否批量 `take()`，回调中是否执行阻塞业务？
- [ ] 周期流是否需要 Deadline；RPC 是否有独立 request ID、单调时钟 deadline 与迟到响应策略？
- [ ] 是否考虑了高负载场景（压力测试）？

---

## 七、Trade-off分析

### 方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| depth=1 | 省内存 | 只保留最新未取样值 | 最新状态流 |
| depth=N | 有界积压 | 需要测量突发与消费延迟 | 请求、命令和遥测 |
| KEEP_ALL + 有界 resource limits | 避免按 depth 淘汰 | 满载时必须定义背压/失败行为 | 审计事件、受控日志流 |

---

### 我们的选择

案例最终选择 `depth=8`，因为在当时测得的突发和消费延迟下它覆盖了 reader backlog，且资源开销可接受。这个值不是通用推荐；换 payload、频率、回调模型或 DDS 实现后必须重新测量。

**如果未来需要支持>500Hz呢？**
- 先测 reader backlog、writer unacknowledged samples 和 resource-limit 命中；
- 再决定扩大有界队列、拆分 instance/topic、批量取样或增加消费者；
- shared-memory transport 只能减少序列化和拷贝成本，不能自动解决消费速度不足或请求超时语义。

---

## 八、相关问题

### Q1: 为什么不用gRPC？

| 维度 | gRPC | DDS |
|------|------|-----|
| 通信模型 | HTTP/2 RPC、streaming | 数据中心发布订阅，可构建 request/reply |
| 发现 | 通常依赖地址、DNS、负载均衡或服务发现 | DDS participant/topic 自动发现 |
| 时限 | 原生 deadline/cancellation API | Deadline QoS 监控 instance 更新；RPC 时限仍需应用协议 |
| 策略 | keepalive、流控、重试、负载均衡等 | Reliability、Durability、History、Deadline 等 DDS QoS |

**我们的选择**：
- 低延迟路径：用DDS（运动控制）
- 普通路径：用gRPC（任务规划、HMI）

---

### Q2: DDS vs ROS 2的关系？

ROS 2 通过 `rmw` 抽象接入中间件。主流 RMW 使用 DDS，也存在非 DDS 实现，因此不能把两者写成完全等号：
```
ROS 2 应用层
    ↓
rclcpp/rclpy (ROS 2 client library)
    ↓
rmw (ROS Middleware Interface)
    ↓
DDS或其他RMW实现 (Fast DDS / Cyclone DDS / RTI Connext / Zenoh ...)
```

**我们遇到的问题也适用于ROS 2！**

---

### Q3: 如何选择DDS实现？

| 实现 | 厂商 | 许可证 | 性能 | 易用性 |
|------|------|--------|------|--------|
| Fast DDS | eProsima | Apache 2.0 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Cyclone DDS | Eclipse | EPL 2.0 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| RTI Connext | RTI | 商业 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**案例使用**：Fast DDS。ROS 2 的默认 RMW 会随发行版和安装方式变化，应以目标系统的 `RMW_IMPLEMENTATION` 与发行版文档为准。

---

## 九、经验教训

### 1. 业务语义与缓存策略不匹配是隐蔽的 bug

**特点**：
- ✅ 低负载正常（消息处理及时，不会覆盖）
- ❌ 高负载失败（消息堆积，触发覆盖）
- ❌ 偶发（不是100%失败，难以复现）

**教训**：
- Writer 和 Reader 要分别按职责完成兼容性与容量检查
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
2. **根因**：Reader 的 `KEEP_LAST(depth=1)` 与“每个请求都必须处理”的业务语义不匹配，应用消费速度又不足以覆盖突发
3. **后果**：未取走请求从 reader history 中被淘汰，业务层无法处理对应请求
4. **解决**：按最坏积压扩大并验证 Reader history/resource limits，同时补齐单请求 deadline 与观测
5. **验证**：压力测试未再复现原故障；100 小时记录未公开，作为案例观察保留

---

### 关键技术点

- ✅ QoS 先检查兼容性，再分别预算 writer 与 reader 容量
- ✅ `RELIABLE` 不等于应用必然处理每个历史样本
- ✅ RPC deadline 与 DDS Deadline QoS 解决的是不同问题
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

1. [Fast DDS 标准 QoS 策略](https://fast-dds.docs.eprosima.com/en/latest/fastdds/dds_layer/core/policy/standardQosPolicies.html)
2. [ROS 2 QoS 兼容性与策略说明](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html)
3. [OMG Data Distribution Service 规范入口](https://www.omg.org/spec/DDS/)
4. [gRPC Deadlines 指南](https://grpc.io/docs/guides/deadlines/)
