---
title: ROS 2 参数体系：为什么 declare 之后的类型和范围不能再变
date: 2026-09-08 09:30:00
permalink: /2026/09/08/ros2-parameters-declaration-lifecycle/
categories: [技术, ROS 2]
tags: [参数, 节点配置, 类型约束, 参数回调]
---

把配置从代码里挪到参数，通常被当作纯粹的整理工作。但参数不只是“可运行时修改的变量”，它带有类型、默认值、约束和变更通知。如果这些信息没有被声明清楚，参数系统就无法在修改发生时判断这次改动是否合法。

这篇文章按参数的生命周期展开：声明时确定什么、修改时能校验什么、以及为什么“运行时可变”不等于“随时可改”。

<div class="note-flow"><span>declare 声明名称与类型</span><i>→</i><span>设置默认值与描述</span><i>→</i><span>附加范围约束</span><i>→</i><span>参数覆盖生效</span><i>→</i><span>参数回调校验</span><i>→</i><span>接受或拒绝变更</span></div>

<figure class="note-visual"><figcaption><span>声明是一个契约</span>类型、默认值和约束在声明时固定，之后所有修改都要通过校验。</figcaption><div class="note-map"><span><b>类型</b><small>声明后不可更改，整数参数不能后来变成字符串。</small></span><span><b>默认值</b><small>没有覆盖时的取值，必须本身合法。</small></span><span><b>约束</b><small>整数范围与浮点范围可在声明时附加。</small></span><span><b>描述</b><small>让参数自解释，参数列表本身就是文档。</small></span><span><b>参数回调</b><small>在变更被接受前校验跨参数一致性。</small></span><span><b>初始参数文件</b><small>启动时的覆盖来源，优先级需要明确记录。</small></span></div></figure>

## 声明时确定的是类型，不是值

参数的名称和类型在声明时固定，值可以被覆盖。这意味着不是所有参数都适合做成可运行时修改：如果一个参数被用来决定内存布局、队列容量或数组维度，中途改变它可能要求重新分配资源，而参数回调里通常不适合做这件事。

实用的判断标准是：这次修改是否需要重建内部结构。如果答案是需要，那么这个参数更适合作为启动参数，在变更时拒绝或者要求重启。

## 范围约束要写在声明里

最基础的校验是范围，它可以直接在声明时表达：

```cpp
node->declare_parameter("control_period_ms", 10, 
    rcl_interfaces::msg::ParameterDescriptor{}
        .set__description("控制周期，单位毫秒")
        .set__integer_range({rcl_interfaces::msg::IntegerRange()
            .set__from_value(1)
            .set__to_value(1000)
            .set__step(1)}));
```

声明之后，越界的覆盖会被直接拒绝。这一步能挡掉很多配置错误，而且拒绝发生在修改时刻，而不是等到控制循环里出现除零或数组越界。

单参数约束无法表达的是交叉关系。比如“最小速度必须小于最大速度”，或者“超时时间必须小于父任务预算”。这类条件需要参数回调。

## 参数回调是最后一道校验

```cpp
node->add_on_set_parameters_callback(
    [](const std::vector<rclcpp::Parameter> & params) {
        rcl_interfaces::msg::SetParametersResult result;
        result.successful = true;
        for (const auto & p : params) {
            if (p.get_name() == "min_speed" && p.as_double() >= current_max_speed) {
                result.successful = false;
                result.reason = "min_speed 必须小于 max_speed";
            }
        }
        return result;
    });
```

回调返回失败时，这次修改不会生效。这比“接受修改再在下一周期发现不一致”更安全，因为拒绝是原子的，不会留下部分应用的配置。

回调里不应该做重活。参数修改是低频操作，但如果在回调里加锁并等待控制线程，就可能反过来影响控制循环的时序。需要重建资源的变更，更稳妥的做法是标记为“需要重启后生效”。

## 验证参数的三个层次

一次完整的参数验证至少覆盖：默认值是否可用、覆盖是否按预期生效、非法值是否被拒绝。

```bash
# 列出当前实际生效的参数与类型
ros2 param list /my_node
ros2 param get /my_node control_period_ms

# 尝试越界修改，应被拒绝
ros2 param set /my_node control_period_ms 5000

# 用参数文件启动，确认覆盖优先级
ros2 run my_package my_node --ros-args --params-file config/robot.yaml
```

第三条容易被忽略。参数文件的路径、节点名匹配规则和启动参数优先级如果没有记录，就会出现“改了文件但没生效”的情况，而实际原因是节点名和 YAML 里的键没对上，或者命令行参数覆盖了文件。

## 参数不是状态同步机制

参数适合描述配置，不适合承载运行状态。用参数发布当前速度、剩余电量或任务进度，会让修改语义变得混乱：外部到底是读取状态，还是试图改变它。

这类信息应该走话题或服务。参数的价值在于“可被声明、可被校验、可被记录”的配置契约，一旦被用来传递高频变化的状态，校验和语义都会失去意义。

## 参考资料

- [ROS 2 参数概念说明](https://docs.ros.org/en/jazzy/Concepts/Basic/About-Parameters.html)
- [C++ 中使用参数与参数回调](https://docs.ros.org/en/jazzy/Tutorials/Beginner-Client-Libraries/Using-Parameters-In-A-Class-CPP.html)
- [参数设计文档：类型与命名约束](https://design.ros2.org/articles/ros_parameters.html)

## 证据边界

本文讨论参数声明、校验与变更语义，不包含任何具体节点的参数清单。文中给出的范围约束和回调是通用结构，实际是否适合运行时修改，取决于该参数是否会触发资源重建，需要按具体节点判断。
