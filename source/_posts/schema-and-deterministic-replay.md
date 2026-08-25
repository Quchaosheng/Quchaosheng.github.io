---
title: 多模块协作怎样少靠口头约定：Schema 与确定性回放
date: 2026-08-21 20:30:00
permalink: /2026/08/21/schema-and-deterministic-replay/
categories: [技术, 项目方法]
tags: [JSON Schema, 事件溯源, 确定性回放, 协作]
---

多人并行开发机器人系统时，最常见的摩擦不是代码写不出来，而是模块对字段、版本、启动顺序和失败语义的理解逐渐漂移。接口文档如果只靠自然语言，很难及时发现“双方都能运行，但理解不同”。

我的做法是把跨模块消息变成可检查的 schema，并把关键状态变化写成追加式事件，以固定输入进行确定性回放。

<div class="note-flow"><span>Schema 校验输入</span><i>→</i><span>模块处理</span><i>→</i><span>追加事件</span><i>→</i><span>固定 seed 回放</span><i>→</i><span>比较状态与顺序</span></div>

<div class="note-map"><span><b>合同</b><small>约束结构与版本</small></span><span><b>事件</b><small>保存身份与因果</small></span><span><b>回放</b><small>隔离输出并复核判定</small></span></div>

## Schema 是边界合同

Schema 应约束必填字段、枚举、范围、版本和条件关系，并为未知版本提供明确拒绝路径。它不能代替业务逻辑，但能让非法输入在模块边界尽早失败，而不是进入运行时后变成模糊状态。

版本迁移要显式。消费者应知道自己接受哪些版本，生产者也应保留兼容测试。仅仅新增一个可选字段，有时仍会改变默认行为，不能假设“JSON 能解析”就兼容。

## 回放是重新运行判定，不是重发动作

事件应包含稳定身份、单调时间、前序关系、输入摘要和版本指纹。回放时固定 seed、初始状态和事件顺序，检查状态机是否得到相同结果。涉及设备输出的模块必须替换为隔离适配器，避免历史事件再次驱动物理设备。

确定性回放特别适合复现并发边界和取消顺序，但不能证明真实世界完全确定。传感器噪声、操作系统调度和硬件时序仍需在相应层验证。

## 参考资料

- [JSON Schema](https://json-schema.org/)
- [Event sourcing pattern](https://martinfowler.com/eaaDev/EventSourcing.html)

## 证据边界

本文不公开任何内部 schema、字段名、模块拓扑、任务数据或团队流程，只总结接口治理和回放验证方法。
