---
title: "事件溯源在机器人系统中的可审计性设计"
date: 2026-08-13 17:35:00
permalink: /2026/08/13/robot-event-sourcing-auditability/
categories:
  - 技术
  - 系统架构
tags:
  - Event Sourcing
  - 事件溯源
  - DDD
  - 可审计性
  - 机器人
description: 用不可变事件、投影、快照和故障回放解释机器人状态如何从当前快照扩展为可审计历史。
---

## 证据边界

公开项目 [workbench-world-model](https://github.com/Quchaosheng/workbench-world-model) 展示了事件存储、投影和故障注入方向；本文中的数据库规模、ISO 适用表述和性能数字仍需结合具体部署、测试记录与合规评估验证。

<div class="note-flow"><span>命令进入系统</span><i>→</i><span>追加不可变事件</span><i>→</i><span>更新投影</span><i>→</i><span>周期生成快照</span><i>→</i><span>按事件回放故障</span></div>

<div class="note-map"><span><b>Event Store</b><small>按顺序追加事实，不原地覆盖历史。</small></span><span><b>Projection</b><small>把事件流转换为面向查询的当前状态。</small></span><span><b>Snapshot</b><small>缩短重放时间，但不能替代原始事件。</small></span><span><b>Version</b><small>乐观并发控制防止并行写入互相覆盖。</small></span><span><b>Replay</b><small>从相同事件恢复状态并定位因果链。</small></span><span><b>审计</b><small>记录本身提供证据，合规仍需完整评估。</small></span></div>

## 一、为什么机器人需要事件溯源

### 传统状态快照的问题

**场景**：机器人装配任务失败，需要复盘

**传统方案**：查看数据库状态
```sql
SELECT * FROM robot_state WHERE timestamp = '2024-08-13 10:23:45';

-- 结果：
robot_id: 1
position: [0.5, 0.3, 0.8]
gripper_state: "open"
task_status: "failed"
error_code: "collision_detected"
```

**问题**：
- ❌ 只知道失败时的状态
- ❌ 不知道**如何**到达这个状态
- ❌ 无法回答："为什么会碰撞？"

---

**事件溯源方案**：完整历史记录
```
T0.0s: TaskStarted { task_id: "asm_001", type: "pick_and_place" }
T0.1s: MotionPlanned { path: [...], duration: 2.5s }
T0.2s: MotionStarted { target: [0.5, 0.3, 0.8] }
T1.0s: ObjectDetected { id: "obstacle_1", position: [0.45, 0.32, 0.75] }
T1.5s: CollisionPredicted { distance: 0.02m, time_to_collision: 0.3s }
T1.8s: EmergencyStopTriggered { reason: "collision_risk" }
T1.8s: TaskFailed { error: "collision_detected" }
```

**优势**：
- ✅ 完整的因果链
- ✅ 可以回放整个过程
- ✅ 可以分析根因

---

## 二、事件溯源核心概念

### 2.1 Event vs State

**状态（State）**：某个时刻的快照
```json
{
  "robot_id": 1,
  "position": [0.5, 0.3, 0.8],
  "velocity": [0.1, 0.0, 0.0],
  "gripper_state": "open"
}
```

**事件（Event）**：状态变化的原因
```json
{
  "event_type": "MotionCommandReceived",
  "timestamp": "2024-08-13T10:23:45.123Z",
  "data": {
    "target": [0.5, 0.3, 0.8],
    "velocity": 0.1,
    "acceleration": 0.5
  }
}
```

**关系**：
```
State[t] = reduce(Events[0:t], InitialState)

例如：
InitialState = { position: [0, 0, 0] }
Event1 = MotionCommandReceived { target: [0.5, 0.3, 0.8] }
Event2 = MotionCompleted { actual: [0.5, 0.3, 0.8] }

State[2] = apply(apply(InitialState, Event1), Event2)
         = { position: [0.5, 0.3, 0.8] }
```

---

### 2.2 事件的不可变性

**关键原则**：事件一旦发生，永不删除、永不修改

**错误做法**：
```cpp
// ❌ 直接修改状态
robot.position = new_position;  // 覆盖旧值，历史丢失

// ❌ 删除事件
event_store.delete(event_id);   // 历史被篡改
```

**正确做法**：
```cpp
// ✅ 追加事件
event_store.append(PositionChanged {
    from: old_position,
    to: new_position,
    timestamp: now()
});

// ✅ 如果需要"撤销"，追加补偿事件
event_store.append(MotionCancelled {
    reason: "user_requested",
    timestamp: now()
});
```

---

## 三、架构设计

### 3.1 整体架构

```
┌─────────────────┐
│  Command Side   │  写路径（接收命令，产生事件）
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Event Store    │  事件存储（追加写，永不删除）
└────────┬────────┘
         │
         ├──────────────┐
         ▼              ▼
┌─────────────┐  ┌─────────────┐
│ Projection  │  │ Projection  │  读路径（投影到不同视图）
│  (State)    │  │  (Analytics)│
└─────────────┘  └─────────────┘
```

**关键组件**：

1. **Command Side**：处理命令，验证，产生事件
2. **Event Store**：持久化事件流
3. **Projection**：将事件流投影到查询模型

---

### 3.2 Event Store设计

**接口定义**：
```cpp
// 04-platform/infrastructure/event_store/include/event_store.hpp
class EventStore {
public:
    // 追加事件（幂等，支持重试）
    virtual EventId append(
        const StreamId& stream_id,
        const Event& event,
        ExpectedVersion expected_version
    ) = 0;

    // 读取事件流（支持分页）
    virtual std::vector<Event> read_stream(
        const StreamId& stream_id,
        uint64_t from_version = 0,
        uint64_t max_count = 1000
    ) = 0;

    // 订阅事件流（实时推送）
    virtual Subscription subscribe(
        const StreamId& stream_id,
        EventHandler handler,
        uint64_t from_version = 0
    ) = 0;

    // 快照（优化：避免重放所有事件）
    virtual void save_snapshot(
        const StreamId& stream_id,
        uint64_t version,
        const Snapshot& snapshot
    ) = 0;
};
```

---

**存储格式**（PostgreSQL）：
```sql
CREATE TABLE events (
    event_id        BIGSERIAL PRIMARY KEY,
    stream_id       VARCHAR(255) NOT NULL,
    version         BIGINT NOT NULL,
    event_type      VARCHAR(255) NOT NULL,
    event_data      JSONB NOT NULL,
    metadata        JSONB,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 保证版本唯一性（乐观锁）
    UNIQUE (stream_id, version)
);

-- 索引：按stream_id查询
CREATE INDEX idx_events_stream_id ON events (stream_id, version);

-- 索引：按时间范围查询
CREATE INDEX idx_events_timestamp ON events (timestamp);

-- 索引：按事件类型查询
CREATE INDEX idx_events_type ON events (event_type);
```

---

**示例数据**：
```sql
INSERT INTO events VALUES (
    1,
    'robot-1',
    0,
    'RobotInitialized',
    '{"robot_id": 1, "model": "7-axis-collab"}',
    '{"user": "operator1", "source": "control_panel"}',
    '2024-08-13 10:00:00'
);

INSERT INTO events VALUES (
    2,
    'robot-1',
    1,
    'MotionCommandReceived',
    '{"target": [0.5, 0.3, 0.8], "velocity": 0.1}',
    '{"task_id": "asm_001", "priority": "high"}',
    '2024-08-13 10:00:01'
);
```

---

### 3.3 Event定义

**基类**：
```cpp
// 04-platform/infrastructure/event_store/include/event.hpp
struct Event {
    std::string event_type;
    nlohmann::json data;
    nlohmann::json metadata;
    std::chrono::system_clock::time_point timestamp;

    // 序列化
    std::string to_json() const {
        nlohmann::json j;
        j["event_type"] = event_type;
        j["data"] = data;
        j["metadata"] = metadata;
        j["timestamp"] = std::chrono::duration_cast<std::chrono::milliseconds>(
            timestamp.time_since_epoch()).count();
        return j.dump();
    }
};
```

---

**具体事件**：
```cpp
// 04-platform/perception/world_model/include/events.hpp

// 物体检测事件
struct ObjectDetectedEvent : Event {
    std::string object_id;
    Eigen::Vector3d position;
    std::string object_type;
    double confidence;

    ObjectDetectedEvent(const std::string& id,
                       const Eigen::Vector3d& pos,
                       const std::string& type,
                       double conf)
        : object_id(id), position(pos),
          object_type(type), confidence(conf)
    {
        event_type = "ObjectDetected";
        data = {
            {"object_id", id},
            {"position", {pos.x(), pos.y(), pos.z()}},
            {"object_type", type},
            {"confidence", conf}
        };
        timestamp = std::chrono::system_clock::now();
    }
};

// 碰撞预测事件
struct CollisionPredictedEvent : Event {
    std::string object_id;
    double distance;
    double time_to_collision;

    CollisionPredictedEvent(const std::string& id,
                           double dist,
                           double ttc)
        : object_id(id), distance(dist),
          time_to_collision(ttc)
    {
        event_type = "CollisionPredicted";
        data = {
            {"object_id", id},
            {"distance", dist},
            {"time_to_collision", ttc}
        };
        timestamp = std::chrono::system_clock::now();
    }
};
```

---

### 3.4 Projection（投影）

**目的**：从事件流构建查询模型

**实时状态投影**：
```cpp
// 04-platform/perception/world_model/src/world_state_projection.cpp
class WorldStateProjection {
public:
    WorldStateProjection(EventStore& store)
        : store_(store)
    {
        // 订阅所有世界模型相关事件
        subscription_ = store_.subscribe(
            "world-model",
            [this](const Event& event) { handle_event(event); }
        );
    }

    void handle_event(const Event& event) {
        if (event.event_type == "ObjectDetected") {
            auto obj_event = parse_object_detected(event);

            // 更新内存中的状态
            objects_[obj_event.object_id] = {
                .position = obj_event.position,
                .type = obj_event.object_type,
                .confidence = obj_event.confidence,
                .last_updated = event.timestamp
            };

        } else if (event.event_type == "ObjectRemoved") {
            auto obj_id = event.data["object_id"];
            objects_.erase(obj_id);
        }
    }

    // 查询接口
    std::vector<Object> get_all_objects() const {
        std::vector<Object> result;
        for (const auto& [id, obj] : objects_) {
            result.push_back(obj);
        }
        return result;
    }

private:
    EventStore& store_;
    Subscription subscription_;
    std::unordered_map<std::string, Object> objects_;
};
```

---

**分析投影**（数据仓库）：
```cpp
// 05-application/analytics/src/task_statistics_projection.cpp
class TaskStatisticsProjection {
public:
    void handle_event(const Event& event) {
        if (event.event_type == "TaskCompleted") {
            auto duration = event.data["duration_ms"];
            auto task_type = event.data["task_type"];

            // 插入到时序数据库（InfluxDB）
            influxdb_.write(
                "task_duration",
                {{"type", task_type}},  // tags
                {{"value", duration}},   // fields
                event.timestamp
            );

        } else if (event.event_type == "TaskFailed") {
            auto error_code = event.data["error_code"];

            influxdb_.write(
                "task_failures",
                {{"error", error_code}},
                {{"count", 1}},
                event.timestamp
            );
        }
    }
};
```

---

## 四、实战案例：故障回放

### 4.1 问题场景

**故障描述**：装配任务失败，机器人碰撞检测触发

**传统调试**：
```bash
# 查看日志
tail /var/log/robot.log
# [ERROR] Task failed: collision_detected

# 查看状态
rostopic echo /robot/state
# position: [0.5, 0.3, 0.8]
# error: "collision_detected"

# ❌ 信息不足，无法定位根因
```

---

### 4.2 事件溯源调试

**步骤1：查询事件流**
```cpp
// 查询任务相关的所有事件
auto events = event_store.read_stream(
    "task-asm_001",
    0,  // 从头开始
    1000
);

for (const auto& event : events) {
    std::cout << event.timestamp << " "
              << event.event_type << " "
              << event.data.dump() << std::endl;
}
```

**输出**：
```
2024-08-13 10:00:00.000 TaskStarted {"task_id":"asm_001","type":"pick_and_place"}
2024-08-13 10:00:00.100 MotionPlanned {"path":[...],"duration":2.5}
2024-08-13 10:00:00.200 MotionStarted {"target":[0.5,0.3,0.8]}
2024-08-13 10:00:01.000 ObjectDetected {"id":"obstacle_1","position":[0.45,0.32,0.75]}
2024-08-13 10:00:01.500 CollisionPredicted {"distance":0.02,"ttc":0.3}
2024-08-13 10:00:01.800 EmergencyStopTriggered {"reason":"collision_risk"}
2024-08-13 10:00:01.800 TaskFailed {"error":"collision_detected"}
```

---

**步骤2：回放事件**
```cpp
// 重建当时的世界模型
WorldState world_state;

for (const auto& event : events) {
    // 逐个应用事件
    if (event.event_type == "ObjectDetected") {
        world_state.add_object(
            event.data["id"],
            parse_vector(event.data["position"]),
            event.data["object_type"]
        );

    } else if (event.event_type == "MotionStarted") {
        auto target = parse_vector(event.data["target"]);

        // 检查碰撞
        auto collision = world_state.check_collision_along_path(
            world_state.robot_position(),
            target
        );

        if (collision.has_value()) {
            std::cout << "Found collision: "
                      << "object=" << collision->object_id
                      << ", distance=" << collision->distance
                      << std::endl;
        }
    }
}
```

---

**步骤3：根因分析**
```
发现：
1. T=1.0s: 检测到障碍物 obstacle_1 在 [0.45, 0.32, 0.75]
2. T=0.2s: 运动已经开始，目标 [0.5, 0.3, 0.8]
3. 问题：运动规划在物体检测之前完成
        -> 规划器不知道有障碍物
        -> 路径会碰撞

根因：运动规划没有等待最新的环境感知
解决：引入感知就绪检查
```

---

### 4.3 修复后的事件流

```
2024-08-13 11:00:00.000 TaskStarted
2024-08-13 11:00:00.050 PerceptionUpdateRequested  ← 新增：请求感知更新
2024-08-13 11:00:00.150 ObjectDetected {"id":"obstacle_1",...}
2024-08-13 11:00:00.200 PerceptionReady            ← 新增：感知就绪
2024-08-13 11:00:00.300 MotionPlanned {"avoid_objects":["obstacle_1"],...}
2024-08-13 11:00:00.400 MotionStarted
2024-08-13 11:00:02.900 MotionCompleted
2024-08-13 11:00:03.000 TaskCompleted
```

---

## 五、性能优化

### 5.1 快照（Snapshot）

**问题**：重放10000个事件很慢

**方案**：定期保存快照

```cpp
// 每100个事件保存一次快照
if (event.version % 100 == 0) {
    auto snapshot = world_state.to_snapshot();
    event_store.save_snapshot(
        "robot-1",
        event.version,
        snapshot
    );
}

// 恢复时：从最近的快照开始
auto snapshot = event_store.load_snapshot("robot-1");
WorldState world_state = WorldState::from_snapshot(snapshot);

// 只重放快照之后的事件
auto events = event_store.read_stream(
    "robot-1",
    snapshot.version + 1  // 从快照之后开始
);
```

**性能对比**：
```
重放10000个事件：
- 无快照：~5000ms
- 有快照（每100个）：~50ms（100x提升）
```

---

### 5.2 事件批量写入

**问题**：高频事件（1000Hz）写入慢

**方案**：批量提交

```cpp
class BatchedEventStore {
private:
    std::vector<Event> buffer_;
    std::mutex mutex_;
    std::thread flush_thread_;

public:
    void append(const Event& event) {
        std::lock_guard<std::mutex> lock(mutex_);
        buffer_.push_back(event);

        // 批量大小达到100，立即刷新
        if (buffer_.size() >= 100) {
            flush();
        }
    }

    void flush() {
        if (buffer_.empty()) return;

        // 批量写入数据库
        db_.begin_transaction();
        for (const auto& event : buffer_) {
            db_.insert(event);
        }
        db_.commit();

        buffer_.clear();
    }

    // 后台定期刷新（100ms）
    void background_flush() {
        while (running_) {
            std::this_thread::sleep_for(std::chrono::milliseconds(100));

            std::lock_guard<std::mutex> lock(mutex_);
            flush();
        }
    }
};
```

**性能对比**：
```
写入1000个事件：
- 逐个写入：~1000ms（1ms/事件）
- 批量写入：~50ms（0.05ms/事件，20x提升）
```

---

## 六、与ROS 2集成

### ROS 2事件桥接

```cpp
// 05-application/ros2_bridge/src/event_publisher.cpp
class ROS2EventPublisher {
public:
    ROS2EventPublisher(rclcpp::Node& node, EventStore& store)
        : node_(node), store_(store)
    {
        // 订阅事件流
        subscription_ = store_.subscribe(
            "robot-1",
            [this](const Event& event) { publish_to_ros(event); }
        );

        // 创建ROS发布器
        event_pub_ = node_.create_publisher<std_msgs::msg::String>(
            "/events", 10
        );
    }

private:
    void publish_to_ros(const Event& event) {
        std_msgs::msg::String msg;
        msg.data = event.to_json();
        event_pub_->publish(msg);
    }

    rclcpp::Node& node_;
    EventStore& store_;
    Subscription subscription_;
    rclcpp::Publisher<std_msgs::msg::String>::SharedPtr event_pub_;
};
```

---

## 七、总结

### 事件溯源的优势

✅ **可审计性**：完整的历史记录可为 ISO 13849 相关评估提供证据，但不能单独证明系统合规
✅ **调试友好**：可以精确回放故障场景
✅ **时间旅行**：可以回到任意历史状态
✅ **分析能力**：支持复杂的数据分析

---

### 何时使用事件溯源

**适合**：
- 需要审计（金融、医疗、工业）
- 需要历史分析
- 状态变化复杂

**不适合**：
- 简单CRUD应用
- 实时性要求极高（<1ms）
- 存储成本敏感

---

### 关键设计点

1. **事件不可变**：追加写，永不删除
2. **版本管理**：乐观锁，防止冲突
3. **快照优化**：避免重放所有事件
4. **批量写入**：提升高频场景性能

---
