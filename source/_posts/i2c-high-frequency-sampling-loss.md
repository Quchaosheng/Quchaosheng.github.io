---
title: "I2C 驱动高频采样丢包的定位与修复"
date: 2026-08-13 17:39:00
permalink: /2026/08/13/i2c-high-frequency-sampling-loss/
categories:
  - 技术
  - 嵌入式 Linux
tags:
  - I2C
  - Linux 驱动
  - BSP
  - 中断
  - 性能分析
description: 用示波器、ftrace 和驱动代码审查分层定位高频 I2C 采样丢失，并比较 Threaded IRQ、FIFO 与 DMA 的取舍。
---

## 证据边界

公开仓库未提供对应 RK3576 板卡、示波器波形和驱动压测工程，文中的硬件日志与性能数字不能由公开仓库独立复现；本文重点记录分层定位方法和驱动设计取舍。

<div class="note-flow"><span>确认高频丢样</span><i>→</i><span>检查物理波形</span><i>→</i><span>用 ftrace 定位中断延迟</span><i>→</i><span>调整 IRQ 与 FIFO</span><i>→</i><span>长时间压测</span></div>

<div class="note-map"><span><b>硬件层</b><small>检查上拉、频率、边沿与器件响应。</small></span><span><b>驱动层</b><small>观察中断处理、锁和队列是否阻塞。</small></span><span><b>数据路径</b><small>确认 FIFO 深度和消费速度能覆盖突发。</small></span><span><b>Threaded IRQ</b><small>把可睡眠和较重处理移出硬中断。</small></span><span><b>DMA</b><small>大批量传输时降低 CPU 搬运成本。</small></span><span><b>验证</b><small>同时统计丢样率、CPU 占用和最坏延迟。</small></span></div>

## 一、问题现场

在为七轴机械臂开发RK3576 BSP时，遇到了一个诡异的问题：

**故障现象**：
- I2C传感器采样频率：1000 Hz（每秒1000次读取）
- **丢包率：5-8%**（每秒丢失50-80个样本）
- 偶发，无规律
- 低频（<100 Hz）正常，高频必现

**日志片段**：
```
[I2C] Read sensor data: seq=1234, value=0x1234
[I2C] Read sensor data: seq=1235, value=0x1267
[ERROR] I2C transfer timeout, seq=1236
[I2C] Read sensor data: seq=1237, value=0x12A3
[ERROR] I2C transfer timeout, seq=1238
```

**影响**：
- 运动控制精度下降40%
- 高速运动时轨迹抖动
- 客户投诉产品不稳定

---

## 二、问题定位（三层剖析）

### 第一层：硬件排查

**假设**：I2C总线信号质量问题

**验证**：
```bash
# 1. 示波器抓取I2C信号
# SCL频率：400 kHz
# 记录上升/下降时间、setup/hold、clock stretching、NACK和bus busy

# 2. 通过板级设备树或厂商内核提供的接口降低频率
# 上游 i2c-rk3x 通常读取 DT 的 clock-frequency，不存在通用 bus_clk_rate sysfs ABI

# 3. 更换传感器
# 结果：问题依旧
```

降低频率且波形目测正常，只能暂时降低物理层嫌疑，不能排除上拉电阻、总线电容、器件最短采样间隔、clock stretching、NACK 和总线恢复问题。

---

### 第二层：驱动代码审查

先确认实际运行的内核版本、厂商 commit、设备树和驱动绑定。上游 `drivers/i2c/busses/i2c-rk3x.c` 的普通 `.xfer` 由硬中断推进状态机，并通过 wait queue 等待完成；polling 路径主要服务 `.xfer_atomic`。控制器每批最多处理 32 字节（8 个 32 位数据寄存器），不是“未使用 8 字节 FIFO、每次 1 字节”。若案例使用厂商私有分支，应保存相对上游的 diff，不能用假想代码替代根因证据。

**ftrace分析**：
```bash
# 开启ftrace
echo 1 > /sys/kernel/debug/tracing/events/i2c/enable
cat /sys/kernel/debug/tracing/trace

# 常见上游事件包括 i2c_write/read/result/reply，具体取决于内核配置
# 同时采集 sched、irq 和 function_graph 才能区分事务耗时与CPU忙等
```

这里应按返回码分组：`-ETIMEDOUT`、`-ENXIO`、`-EAGAIN` 和 deadline miss 代表不同问题。仅凭一段 80us 间隔不能认定 CPU busy-wait；候选根因需要用 trace、寄存器状态和驱动版本共同闭环。

---

### 第三层：方案设计

**优化策略**：
1. **先修真实错误路径**：依据 errno、IRQ 状态、NACK/bus busy 和 deadline miss 分类
2. **利用控制器批处理能力**：严格按真实寄存器布局与消息边界推进状态机
3. **调整采样架构**：连续传感器优先评估 DRDY、器件 FIFO 与 IIO triggered buffer
4. **条件优化**：只有实测证明 handler 过重或大消息搬运成为瓶颈时，再评估 Threaded IRQ 或 DMA

---

## 三、解决方案

### 方案实现

**1. 先判断是否需要 Threaded IRQ**

Threaded IRQ 适合把必须睡眠或耗时较长的工作移出 hard IRQ，但会增加一次线程调度，不天然降低 I2C 传输延迟。上游 `i2c-rk3x` 的 handler 主要在锁内读取状态、搬运一批寄存器数据并推进状态机；只有 function graph 和 IRQ-off 数据证明 handler 过长，或厂商分支确实放入了不适合 hard IRQ 的工作时，才应评估 threaded IRQ。

若采用 top half + thread，top half 必须正确 mask/ack 中断并安全累积状态，thread 完成后再恢复；简单覆盖一个 `irq_status` 字段可能丢 pending 位或造成中断风暴。

---

**2. 按真实硬件边界批处理**

缓冲优化必须依照控制器真实寄存器布局实现。以当前上游 `i2c-rk3x` 为例，每批最多处理 32 字节，循环边界必须同时受本批容量与 `processed < msg->len` 约束，并正确读取、清除对应 pending 位。中断次数由消息长度、读写组合、硬件阈值和协议开销共同决定，不能从“每批 N 字节”直接推导减少 N 倍；文中短 SMBus 读取尤其不一定受益。

---

**3. 是否使用 regmap 属于维护性决策**

```c
// 原始方案：直接readl/writel
u32 status = readl(i2c->regs + REG_INT_STATUS);
writel(status, i2c->regs + REG_INT_STATUS);  // Clear interrupt

// 优化方案：使用regmap
static const struct regmap_config rk3x_i2c_regmap_config = {
    .reg_bits = 32,
    .val_bits = 32,
    .max_register = 0x100,
    .cache_type = REGCACHE_NONE,  // I2C状态寄存器不缓存
};

i2c->regmap = devm_regmap_init_mmio(dev, i2c->regs,
                                     &rk3x_i2c_regmap_config);

// 使用regmap API
regmap_read(i2c->regmap, REG_INT_STATUS, &status);
regmap_write(i2c->regmap, REG_INT_STATUS, status);
```

regmap 可以统一寄存器访问并提供调试能力，但不是丢样或 CPU 占用的通用修复，也不能替代驱动状态机自身的同步。它的抽象和锁还可能增加开销，应由寄存器语义、现有 MMIO helper 和维护需求决定。

---

## 四、性能对比

### 测试环境

测试应由单调时钟的绝对 deadline 驱动 1kHz 读取，不能使用无节拍的 tight loop。每次采样至少记录计划时间、实际开始/结束时间、传感器 sequence、返回 errno 和总线恢复动作，再分别统计 deadline miss、序号缺口、总线错误和传输延迟。

### 结果报告

案例稿中的“5-8% 到 0%”“CPU 40% 到 12%”和中断频率数据缺少原始 trace、驱动 commit 与测试程序，不能当作公开复现结果。正式报告应至少包含：

| 指标 | 解释 |
|------|------|
| 计划/实际采样次数 | 区分调度未发起与总线事务失败 |
| Deadline miss | 报告次数、连续次数、P99/P99.9和最大值 |
| 传感器序号缺口 | 与 I2C errno 分开统计 |
| errno 分布 | 区分 NACK、仲裁丢失、超时和其他错误 |
| IRQ/CPU 数据 | 给出消息长度、控制器批次和压力负载 |

### 稳定性测试

```bash
# 连续运行24小时
./i2c_stress_test --duration 86400

# 报告完整配置、计划/实际次数、每类错误与最大连续异常
```

即便在特定条件下 86400000 次事务未观察到错误，也只能给出该条件下的观察结果或统计上限，不能证明真实错误率为 0 或问题被“完全消除”。

---

## 五、技术沉淀

### 1. I2C驱动性能优化Checklist

- [ ] 固定内核、驱动 commit、设备树和器件版本
- [ ] 按 errno、序号缺口和 deadline miss 分类
- [ ] 核对控制器真实批处理容量与消息边界
- [ ] 评估 DRDY、器件 FIFO 与 IIO triggered buffer
- [ ] 仅在大消息且控制器支持时评估 DMA
- [ ] 添加超时机制（防止死锁）
- [ ] 实现错误恢复（总线recovery）

---

### 2. 调试工具链

**ftrace**：
```bash
# 跟踪I2C传输
echo 1 > /sys/kernel/debug/tracing/events/i2c/enable
cat /sys/kernel/debug/tracing/trace
```

**i2c-tools**：
```bash
# 安全枚举适配器，不发送探测事务
i2cdetect -l

# i2cdetect -y 和 i2cget 会访问总线；仅在停机维护窗口、
# 确认器件允许且没有绑定驱动竞争时使用
```

**示波器/逻辑分析仪**：
- 抓取SCL/SDA信号
- 验证时序是否符合I2C协议

---

### 3. 常见坑点

**坑1：Hard IRQ中睡眠**
```c
// ❌ 错误：在Hard IRQ中调用可睡眠函数
static irqreturn_t i2c_irq(int irq, void *dev_id) {
    msleep(10);  // BUG！Hard IRQ不能睡眠
}

// ✅ 正确：使用Threaded IRQ
static irqreturn_t i2c_irq_thread(int irq, void *dev_id) {
    msleep(10);  // OK，线程可以睡眠
}
```

**坑2：照搬其他控制器的 FIFO 寄存器**

不同 I2C 控制器的数据寄存器、pending 位和清除语义不同。只能依据当前 SoC TRM 与实际驱动实现处理残留状态，不能把 `FIFO_CLR` 之类的占位寄存器当作 RK3576 可直接使用的代码。

**坑3：时钟未配置**
```dts
// 仅示意板级覆写；地址、IRQ和clock ID来自SoC DTSI/TRM
&i2c0 {
    status = "okay";
    clock-frequency = <400000>;  // 400kHz
};
```

---

## 六、经验总结

### 定位方法论

1. **分层排查**：硬件 → 驱动 → 应用
2. **工具组合**：示波器 + ftrace + 代码审查
3. **量化分析**：不要靠猜，用数据说话

### 优化原则

1. **先profile，再优化**：不要盲目优化
2. **优化瓶颈**：找到性能瓶颈（CPU、中断、总线）
3. **保持证据链**：每个改动都对应一种已测量的瓶颈，并能单独回归

### Trade-off

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| Polling | 简单 | CPU占用高 | 低频、简单场景 |
| Hard IRQ | 响应快 | 阻塞其他中断 | 简单、快速处理 |
| Threaded IRQ | 允许睡眠和复杂处理 | 增加调度点 | 实测 hard IRQ 过重 |
| DMA | 大消息下可降搬运成本 | 配置复杂，小消息可能更慢 | 控制器支持的大数据量 |

---

## 七、后续优化方向

1. **采样触发**：评估传感器 DRDY 与 IIO triggered buffer
2. **错误统计**：区分序号缺口、deadline miss 和每类 errno
3. **性能监控**：由非实时路径导出长期指标

---

**总结**：这个案例最可靠的沉淀不是固定的“Threaded IRQ + FIFO”组合，而是分层定位和可复核测量。对 1kHz 连续传感器，先确认总线预算与器件采样语义，再评估 DRDY、器件 FIFO 和 IIO 缓冲；只有证据指向驱动 handler 或大消息搬运时，才引入对应的 IRQ 或 DMA 优化。

---

## 参考资料

- [Linux I2C/SMBus 子系统文档](https://docs.kernel.org/i2c/summary.html)
- [Linux 通用 IRQ 子系统文档](https://docs.kernel.org/core-api/genericirq.html)
- [Linux I2C DMA 注意事项](https://docs.kernel.org/i2c/dma-considerations.html)
- [Linux IIO 缓冲区](https://docs.kernel.org/iio/iio_devbuf.html)
- [上游 i2c-rk3x 驱动](https://github.com/torvalds/linux/blob/master/drivers/i2c/busses/i2c-rk3x.c)
