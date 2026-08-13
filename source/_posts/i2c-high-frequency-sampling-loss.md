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
# SDA信号：边沿干净，无振铃

# 2. 降低I2C频率测试
echo 100000 > /sys/bus/i2c/devices/i2c-0/bus_clk_rate  # 降到100kHz
# 结果：丢包依然存在

# 3. 更换传感器
# 结果：问题依旧
```

**结论**：❌ 不是硬件问题

---

### 第二层：驱动代码审查

**RK3576 I2C驱动关键路径**：

```c
// drivers/i2c/busses/i2c-rk3x.c
static int rk3x_i2c_xfer(struct i2c_adapter *adap,
                         struct i2c_msg *msgs, int num)
{
    struct rk3x_i2c *i2c = i2c_get_adapdata(adap);

    // 问题1：使用polling模式，CPU一直等待
    while (!(readl(i2c->regs + REG_INT_STATUS) & INT_MBRFIS)) {
        if (timeout_reached())
            return -ETIMEDOUT;  // 超时返回
    }

    // 问题2：没有FIFO缓冲
    // 每次只传输1字节，频繁中断

    return 0;
}
```

**发现的问题**：
1. **Polling模式**：CPU一直忙等，浪费CPU资源
2. **无FIFO利用**：硬件有8字节FIFO，驱动没用
3. **Hard IRQ处理过长**：I2C传输在中断上下文完成

**ftrace分析**：
```bash
# 开启ftrace
echo 1 > /sys/kernel/debug/tracing/events/i2c/enable
cat /sys/kernel/debug/tracing/trace

# 关键发现：
i2c_transfer: adapter=0, msgs=1, start
  ... (CPU busy waiting 80us)
i2c_transfer: adapter=0, msgs=1, done, ret=1

# 问题：高频场景下，CPU来不及响应所有I2C请求
```

**结论**：✅ 找到根因！

---

### 第三层：方案设计

**优化策略**：
1. **使用Threaded IRQ** - 中断处理移到线程
2. **启用FIFO** - 批量传输，减少中断次数
3. **DMA可选** - 超大数据量时启用

---

## 三、解决方案

### 方案实现

**1. 改用Threaded IRQ**

```c
// 原始方案：Hard IRQ
static irqreturn_t rk3x_i2c_irq(int irqno, void *dev_id)
{
    struct rk3x_i2c *i2c = dev_id;

    // ❌ 在Hard IRQ中完成传输（延迟高）
    handle_i2c_transfer(i2c);

    return IRQ_HANDLED;
}

// 优化方案：Threaded IRQ
static irqreturn_t rk3x_i2c_irq(int irqno, void *dev_id)
{
    struct rk3x_i2c *i2c = dev_id;

    // ✅ 快速读取状态，唤醒线程
    i2c->irq_status = readl(i2c->regs + REG_INT_STATUS);

    return IRQ_WAKE_THREAD;  // 唤醒线程处理
}

static irqreturn_t rk3x_i2c_irq_thread(int irqno, void *dev_id)
{
    struct rk3x_i2c *i2c = dev_id;

    // ✅ 在线程上下文处理（可以睡眠、调度）
    handle_i2c_transfer(i2c);

    return IRQ_HANDLED;
}

// 注册Threaded IRQ
devm_request_threaded_irq(dev, irq,
    rk3x_i2c_irq,        // Hard IRQ handler
    rk3x_i2c_irq_thread, // Thread handler
    IRQF_ONESHOT, "i2c-rk3x", i2c);
```

**优势**：
- Hard IRQ快速返回（<5us）
- 传输处理在线程中，不阻塞其他中断
- CPU调度更灵活

---

**2. 启用FIFO缓冲**

```c
#define I2C_FIFO_SIZE 8

static int rk3x_i2c_fill_tx_fifo(struct rk3x_i2c *i2c)
{
    int count = 0;

    // ✅ 批量填充FIFO（最多8字节）
    while (count < I2C_FIFO_SIZE && i2c->msg->len > 0) {
        writeb(i2c->msg->buf[i2c->msg_ptr++],
               i2c->regs + REG_TXDATA);
        count++;
    }

    return count;
}

static int rk3x_i2c_drain_rx_fifo(struct rk3x_i2c *i2c)
{
    int count = 0;

    // ✅ 批量读取FIFO
    while (readl(i2c->regs + REG_INT_STATUS) & INT_MBRFIS) {
        i2c->msg->buf[i2c->msg_ptr++] =
            readb(i2c->regs + REG_RXDATA);
        count++;
    }

    return count;
}
```

**效果**：
- 中断次数减少8倍（8字节/次 vs 1字节/次）
- CPU占用降低70%

---

**3. 使用regmap简化寄存器访问**

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

**优势**：
- 统一的寄存器访问接口
- 自动处理锁
- 调试更方便（regmap debugfs）

---

## 四、性能对比

### 测试环境

```c
// 测试代码
#define TEST_COUNT 100000

for (int i = 0; i < TEST_COUNT; i++) {
    ret = i2c_smbus_read_byte_data(client, REG_SENSOR_DATA);
    if (ret < 0)
        error_count++;
}

printf("Total: %d, Errors: %d, Error rate: %.2f%%\n",
       TEST_COUNT, error_count,
       100.0 * error_count / TEST_COUNT);
```

### 结果对比

| 指标 | 优化前 | 优化后 | 改善 |
|------|--------|--------|------|
| 丢包率（1000Hz） | 5-8% | 0% | ✅ 完全消除 |
| CPU占用 | 40% | 12% | ⬇️ 70% |
| 单次传输延迟 | 120us | 80us | ⬇️ 33% |
| 中断频率 | 8000次/秒 | 1000次/秒 | ⬇️ 87.5% |

### 稳定性测试

```bash
# 连续运行24小时
./i2c_stress_test --duration 86400

# 结果：
Total transfers: 86,400,000
Errors: 0
Success rate: 100.000%
```

---

## 五、技术沉淀

### 1. I2C驱动性能优化Checklist

- [ ] 使用Threaded IRQ（减少Hard IRQ延迟）
- [ ] 启用硬件FIFO（批量传输）
- [ ] 考虑DMA（大数据量场景）
- [ ] 使用regmap（统一寄存器访问）
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
# 扫描I2C总线
i2cdetect -y 0

# 读取寄存器
i2cget -y 0 0x50 0x00
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

**坑2：FIFO未清空**
```c
// ❌ 传输前忘记清空FIFO
i2c_start_transfer();

// ✅ 传输前清空FIFO
writel(I2C_FIFO_CLR, i2c->regs + REG_FIFO_CTRL);
i2c_start_transfer();
```

**坑3：时钟未配置**
```c
// Device Tree中配置I2C时钟
i2c0: i2c@ff110000 {
    compatible = "rockchip,rk3576-i2c";
    clocks = <&cru SCLK_I2C0>, <&cru PCLK_I2C0>;
    clock-names = "i2c", "pclk";
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
3. **保持简单**：优先用成熟方案（Threaded IRQ、regmap）

### Trade-off

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| Polling | 简单 | CPU占用高 | 低频、简单场景 |
| Hard IRQ | 响应快 | 阻塞其他中断 | 简单、快速处理 |
| Threaded IRQ | 不阻塞 | 延迟稍高 | 复杂处理 |
| DMA | CPU占用低 | 复杂 | 大数据量 |

---

## 七、后续优化方向

1. **自适应FIFO深度**：根据传输速率动态调整
2. **错误统计**：记录丢包率、超时次数
3. **性能监控**：集成到系统监控（Prometheus）

---

**总结**：通过Threaded IRQ + FIFO优化，将I2C驱动丢包率从5-8%降到0，CPU占用降低70%。关键是**分层定位 + 工具组合 + 量化分析**。

---

## 参考资料

- [Linux I2C/SMBus 子系统文档](https://docs.kernel.org/i2c/summary.html)
- [Linux 通用 IRQ 子系统文档](https://docs.kernel.org/core-api/genericirq.html)
