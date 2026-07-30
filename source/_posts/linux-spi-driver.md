---
title: Linux SPI 驱动：控制器、设备与传输
date: 2026-02-10 14:00:00
permalink: /2026/07/29/linux-spi-driver/
categories: [技术, 嵌入式Linux]
tags: [SPI, 设备驱动, 设备树]
---

SPI 是时钟同步、全双工的串行总线，但它不定义统一的寄存器协议、设备发现方式或数据帧格式。Linux SPI 子系统因此将两类职责拆开：控制器驱动管理 SoC 的时钟、FIFO、DMA、片选和中断；协议驱动理解某颗传感器、Flash 或 ADC 的命令、寄存器和数据格式。设备树或其他固件描述负责告诉内核“哪条总线上挂着哪颗设备”。

<div class="note-flow"><span>设备树描述外设</span><i>→</i><span>总线匹配并 probe</span><i>→</i><span>构造 transfer/message</span><i>→</i><span>控制器驱动执行</span><i>→</i><span>中断或 DMA 完成</span></div>

## 三层对象如何配合

`spi_controller` 对应硬件控制器；设备树节点创建 `spi_device`，其中包含 chip select、mode、最大频率等板级信息；`spi_driver` 通过 `of_match_table` 匹配并在 probe 中初始化具体器件。协议驱动将一个或多个 `spi_transfer` 组合为 `spi_message`，同步提交或异步提交给 controller。

<div class="note-map"><span><b>spi_controller</b><small>SoC 硬件驱动，负责 FIFO、DMA、时钟、CS 与传输完成</small></span><span><b>spi_device</b><small>总线上的具体外设，来自 DT/ACPI/board info</small></span><span><b>spi_driver</b><small>理解器件命令和寄存器协议，负责 probe/状态机</small></span><span><b>spi_transfer</b><small>一次全双工数据段，包含 tx/rx buffer、长度、速度等</small></span><span><b>spi_message</b><small>多个 transfer 组成一个原子事务，可控制片选保持</small></span><span><b>完成方式</b><small>同步调用便于简单路径；异步调用适合不阻塞上下文</small></span></div>

## SPI mode 和片选边界不能靠猜

CPOL/CPHA 决定时钟空闲电平与采样边沿，设备树 `spi-cpol`、`spi-cpha`/mode 配错时，逻辑分析仪上可能“有波形”却数据全错。频率、bits-per-word、bit order、CS 极性和 transfer 间 CS 是否保持，也都由器件 datasheet 决定。多段读寄存器事务常要求“命令和数据之间 CS 不能释放”。

```c
struct spi_transfer xfers[] = {
    { .tx_buf = &cmd, .len = 1 },
    { .rx_buf = data, .len = data_len },
};
/* 将 xfers 加入同一 spi_message 后提交，维持设备事务边界 */
```

控制器是否能在相邻 transfer 间保持 CS、是否改用 DMA、最小/最大传输长度，都应查 controller capability 和实际硬件波形。

## 驱动调试从外到内

先确认运行时设备树节点、`compatible`、chip select、频率和 pinctrl；再确认 controller 已 probe、时钟/复位/供电资源可用；随后在 protocol driver probe 中读取一个稳定的识别寄存器；最后用逻辑分析仪检查 CS、SCLK、MOSI/MISO、mode 和帧长度。不要一开始就怀疑“SPI 子系统有 bug”。

`spidev` 很适合 bring-up 和产测工具，但不是绕开正式协议驱动的长期替代品。内核需要知道设备的电源管理、并发、错误恢复和系统 suspend/resume 语义，才能让硬件稳定地融入系统。

参考：[SPI subsystem](https://docs.kernel.org/spi/spi-summary.html) · [SPI userspace API](https://docs.kernel.org/spi/spidev.html)
