---
title: ROS 2 参数体系：为什么 declare 之后的类型和范围不能再变
date: 2026-09-08 09:30:00
permalink: /2026/09/08/ros2-parameters-declaration-lifecycle/
categories: [技术, ROS 2]
tags: [参数, 节点配置, 类型约束, 参数回调]
---

一开始我也觉得参数就是把配置从代码挪到 YAML，纯整理工作。后来在一个节点上把 `buffer_size` 做成可运行时修改，改完没崩，但分配好的缓冲区大小没跟着变，行为变得很奇怪。

那时候才明白，参数不只是“可运行时修改的变量”，它带类型、默认值、约束和变更通知。这些没声明清楚，参数系统就没法判断这次改动是否合法。

<div class="note-flow"><span>declare 定名称与类型</span><i>→</i><span>设默认值和描述</span><i>→</i><span>加范围约束</span><i>→</i><span>参数覆盖生效</span><i>→</i><span>参数回调校验</span><i>→</i><span>接受或拒绝变更</span></div>

<figure class="note-visual"><figcaption><span>声明是一份契约</span>类型、默认值和约束在声明时固定，之后每次修改都要过校验。</figcaption><div class="note-map"><span><b>类型</b><small>声明后不能改，整数参数不能后来变字符串。</small></span><span><b>默认值</b><small>没覆盖时的取值，本身必须合法。</small></span><span><b>约束</b><small>整数和浮点范围可以在声明时附加。</small></span><span><b>描述</b><small>让参数自解释，列表本身就是文档。</small></span><span><b>参数回调</b><small>在变更被接受前校验跨参数一致性。</small></span><span><b>参数文件</b><small>启动时的覆盖来源，优先级要记清楚。</small></span></div></figure>

## 判断标准：这次改动要不要重建内部结构

参数的名称和类型在声明时固定，值可以被覆盖。所以不是所有参数都适合做成可运行时修改。如果它决定内存布局、队列容量或者数组维度，中途改它可能要求重新分配资源，而参数回调里通常不适合干这个。

我自己的判断很简单：这次修改要不要重建内部结构。要的话，这个参数更适合当作启动参数，变更时直接拒绝，或者要求重启。

## 范围写在声明里

最基础的校验是范围，声明时就能表达：

```cpp
node->declare_parameter("control_period_ms", 10, 
    rcl_interfaces::msg::ParameterDescriptor{}
        .set__description("控制周期，单位毫秒")
        .set__integer_range({rcl_interfaces::msg::IntegerRange()
            .set__from_value(1)
            .set__to_value(1000)
            .set__step(1)}));
```

声明之后，越界的覆盖会被直接拒掉。这一步能挡下大量配置错误，而且是在修改的那一刻拒绝，不用等到控制循环里出现除零或者数组越界。

单参数约束表达不了的是关系。比如“最小速度必须小于最大速度”，或者“超时时间必须小于父任务预算”。这类得靠参数回调。

## 参数回调是最后一道防线

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

回调返回失败，这次修改就不生效。这比“先接受，下一周期再发现不一致”安全，因为拒绝是原子的，不会留下应用了一半的配置。

回调里别干重活。参数修改是低频操作，但如果在回调里加锁等控制线程，就可能反过来影响控制循环的时序。需要重建资源的变更，更稳妥的是标记成“重启后生效”。

## 三层验证

一次完整的参数验证至少覆盖：默认值能不能用、覆盖有没有按预期生效、非法值有没有被拒。

```bash
# 看实际生效的参数和类型
ros2 param list /my_node
ros2 param get /my_node control_period_ms

# 越界修改，应该被拒
ros2 param set /my_node control_period_ms 5000

# 用参数文件启动，确认覆盖优先级
ros2 run my_package my_node --ros-args --params-file config/robot.yaml
```

第三条最容易被跳过。参数文件的路径、节点名匹配规则和命令行优先级如果不记录，就会出现“改了文件没生效”，而真实原因是节点名和 YAML 里的键对不上，或者命令行把它覆盖了。

## 别拿参数当状态同步

参数适合描述配置，不适合承载运行状态。用参数发布当前速度、剩余电量或者任务进度，会让修改语义变乱：外部到底是在读状态，还是想改它。

这类信息该走话题或服务。参数的价值在于“可声明、可校验、可记录”的配置契约，一旦用来传高频状态，校验和语义都没意义了。

## 参考资料

- [ROS 2 参数概念说明](https://docs.ros.org/en/jazzy/Concepts/Basic/About-Parameters.html)
- [C++ 中使用参数与参数回调](https://docs.ros.org/en/jazzy/Tutorials/Beginner-Client-Libraries/Using-Parameters-In-A-Class-CPP.html)
- [参数设计文档：类型与命名约束](https://design.ros2.org/articles/ros_parameters.html)

**证据边界：**本文不含任何具体节点的参数清单。上面的范围约束和回调是通用结构，某个参数到底适不适合运行时修改，取决于它会不会触发资源重建，得按节点判断。
