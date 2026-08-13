---
title: "RISC-V 多核启动：7+1 hart 异构 SMP 架构"
date: 2026-08-13 17:37:00
permalink: /2026/08/13/riscv-heterogeneous-smp-boot/
categories:
  - 技术
  - RISC-V
tags:
  - RISC-V
  - SMP
  - OpenSBI
  - PMP
  - FreeRTOS
description: 从平台固件、OpenSBI、Linux SMP、PMP 隔离和 doorbell 通信出发，梳理 7+1 hart 异构系统的启动与调试路径。
---

## 证据边界

公开项目 [quard-star-riscv64-net](https://github.com/Quchaosheng/quard-star-riscv64-net) 提供 7+1 hart、OpenSBI domain 和 PMP 故障探针的相关实现；本文选择“平台 M-mode 固件直接接管 hart7”的设计路线。FreeRTOS 集成与部分性能数字不在该公开仓库的完整可复现实验范围内，应按架构说明而非已公开 benchmark 阅读。

<div class="note-flow"><span>平台固件分流 hart</span><i>→</i><span>OpenSBI 服务 Linux domain</span><i>→</i><span>hart7 进入 M-mode RTOS</span><i>→</i><span>按 hart 配置 PMP</span><i>→</i><span>doorbell 与共享内存通信</span></div>

<div class="note-map"><span><b>hart0</b><small>承担 Linux domain 的引导协调。</small></span><span><b>Linux SMP</b><small>7 个 hart 处理通用计算和系统服务。</small></span><span><b>RTOS hart</b><small>由平台固件保留给控制路径。</small></span><span><b>OpenSBI</b><small>只在 Linux harts 提供 M-mode 服务。</small></span><span><b>PMP</b><small>按 hart 限制低特权级物理地址访问。</small></span><span><b>通信</b><small>共享内存承载数据，平台 doorbell 负责通知。</small></span></div>

## 一、项目背景

在开发RISC-V多核实时控制系统时，遇到了一个有趣的需求：

**需求**：
- 7个hart运行Linux SMP（通用计算）
- 1个hart运行FreeRTOS（硬实时控制）
- 两个系统通过共享内存通信

**挑战**：
- RISC-V SMP启动流程复杂
- 异构系统的内存隔离
- hart间通信与同步
- 调试困难（8个核心同时运行）

---

## 二、RISC-V多核基础

### 2.1 关键概念

**hart（Hardware Thread）**：
- RISC-V的"核心"概念
- 每个hart是一个独立的硬件线程
- 可以独立执行指令流

**特权级**：
```
M-mode (Machine)      - 最高权限，固件/bootloader
  ↓
S-mode (Supervisor)   - 操作系统内核（Linux）
  ↓
U-mode (User)         - 用户态应用
```

**SMP启动流程**：
```
1. hart0在M-mode启动（Boot Hart）
2. 其他hart在WFI（Wait For Interrupt）状态
3. hart0初始化完成后，唤醒其他hart
4. 所有hart切换到S-mode，进入Linux
```

---

### 2.2 我们的架构

**8-hart布局**：
```
hart0-6: Linux SMP（S-mode）
  - OpenSBI提供M-mode runtime
  - Linux内核在S-mode运行
  - 用户态在U-mode运行

hart7: FreeRTOS（M-mode）
  - 独占一个hart
  - 直接在M-mode运行（无虚拟内存）
  - 不经过Linux调度，但FreeRTOS与中断仍会产生抢占
```

OpenSBI domain 的 next stage 运行在 S-mode 或 U-mode，不能把 M-mode FreeRTOS 当作 domain payload。另一条可行路线是让 FreeRTOS 运行于 S-mode 并继续通过 SBI 使用 M-mode 服务；本文不混用两种方案。

**内存布局**：
```
物理内存：2GB

0x8000_0000 - 0x8020_0000   OpenSBI (2MB)
0x8020_0000 - 0x8040_0000   Linux Kernel (2MB)
0x8040_0000 - 0xC000_0000   Linux用户空间 (960MB)
0xC000_0000 - 0xC010_0000   共享内存 (1MB)
0xC010_0000 - 0xC020_0000   FreeRTOS代码+数据 (1MB)
0xC020_0000 - 0xFFFF_FFFF   保留 (rest)
```

---

## 三、启动流程设计

### 3.1 第一阶段：OpenSBI初始化

**职责边界**：
- 平台 reset/boot 固件根据 `mhartid` 分流：hart0-6 进入 OpenSBI，hart7 进入专用 M-mode RTOS 入口
- OpenSBI 只管理 Linux domain 的 harts、内存区域、设备和 SBI 服务
- Linux Device Tree 只声明 hart0-6，或把 hart7 标为 `disabled`，防止 Linux 纳入 SMP
- hart7 的 trap、timer、PMP 和 doorbell 由专用平台固件/RTOS port 初始化

OpenSBI 的 domain 描述应使用当前版本支持的 Device Tree binding 或平台 API。这里不展示 `disabled_hart_mask`、`platform_config` 等看似精确但不能对应当前主线的伪 API；实现时应固定 OpenSBI commit 并以该版本文档为准。

**启动流程**：
```
1. ROM/平台固件在每个 hart 读取 mhartid
2. hart0-6 进入 OpenSBI，建立 Linux domain 并配置对应 PMP
3. OpenSBI 把 Linux next stage 交给 S-mode
4. Linux 通过 CPU ops/SBI HSM 启动 domain 内的 hart1-6
5. hart7 由平台固件直接跳转到 FreeRTOS M-mode 入口
6. 两个执行域通过共享内存和平台 doorbell 通信
```

---

### 3.2 第二阶段：Linux SMP启动

**Device Tree配置**（riscv-platform.dts）：
```dts
/ {
    #address-cells = <2>;
    #size-cells = <2>;
    compatible = "riscv-custom-platform";

    cpus {
        #address-cells = <1>;
        #size-cells = <0>;
        timebase-frequency = <10000000>;  // 10MHz

        // hart0-6: Linux SMP
        cpu0: cpu@0 {
            device_type = "cpu";
            reg = <0>;
            status = "okay";
            compatible = "riscv";
            riscv,isa = "rv64imafdcsu";
            mmu-type = "riscv,sv39";  // Sv39分页

            cpu0_intc: interrupt-controller {
                #interrupt-cells = <1>;
                interrupt-controller;
                compatible = "riscv,cpu-intc";
            };
        };

        // cpu1-6类似...

        // hart7: FreeRTOS（disabled for Linux）
        cpu7: cpu@7 {
            device_type = "cpu";
            reg = <7>;
            status = "disabled";  // Linux不管理hart7
            compatible = "riscv";
            riscv,isa = "rv64imafdcsu";
        };
    };

    memory@80000000 {
        device_type = "memory";
        reg = <0x0 0x80000000 0x0 0x40000000>;  // 1GB for Linux
    };

    // 共享内存区域
    reserved-memory {
        #address-cells = <2>;
        #size-cells = <2>;
        ranges;

        shared_mem: shared-memory@c0000000 {
            compatible = "shared-dma-pool";
            reg = <0x0 0xc0000000 0x0 0x100000>;  // 1MB
            no-map;  // 不创建常规线性映射；驱动需显式映射
        };
    };

    // 共享内存驱动
    rpmsg@c0000000 {
        compatible = "riscv,rpmsg";
        reg = <0x0 0xc0000000 0x0 0x100000>;
        interrupts = <10>;  // 平台doorbell中断号，占位示意
    };
};
```

**Linux内核启动流程**：
```
1. head.S: hart0从_start开始
2. 设置临时页表（恒等映射）
3. 跳转到start_kernel（C代码）
4. setup_arch(): 解析Device Tree
5. smp_prepare_cpus(): 准备SMP启动
6. __cpu_up(): 唤醒hart1-6
7. secondary_start_kernel(): 从hart进入调度器
```

Linux 只会遍历 Device Tree 中可用的 CPU 节点，并通过当前内核选择的 RISC-V CPU ops/HSM 路径启动 secondary harts。`secondary_start_kernel()` 是后续入口之一，但具体调用链随内核版本变化；实现和调试时应固定 Linux commit，用 `dmesg`、SBI HSM 返回码和每个 hart 的启动 trace 验证，而不是复制一段自造的 `smp_prepare_cpus()`。

---

### 3.3 第三阶段：FreeRTOS启动

**FreeRTOS独占hart7**：

**链接脚本**（freertos.ld）：
```ld
MEMORY {
    ROM (rx)  : ORIGIN = 0xC0100000, LENGTH = 512K
    RAM (rwx) : ORIGIN = 0xC0180000, LENGTH = 512K
}

SECTIONS {
    .text : {
        *(.text.entry)  /* 入口代码 */
        *(.text*)
    } > ROM

    .data : {
        *(.data*)
        *(.sdata*)
    } > RAM

    .bss : {
        *(.bss*)
        *(.sbss*)
    } > RAM

    /* 为每个任务分配栈 */
    .stack : {
        . = ALIGN(16);
        _stack_start = .;
        . = . + 64K;  /* 64KB栈空间 */
        _stack_end = .;
    } > RAM
}
```

**启动代码**（start.S）：
```asm
.section .text.entry
.global _start

_start:
    # 只有hart7执行这段代码
    csrr t0, mhartid
    li   t1, 7
    bne  t0, t1, _hang  # 如果不是hart7，挂起

    # 设置栈指针
    la sp, _stack_end

    # 清空BSS段
    la t0, __bss_start
    la t1, __bss_end
1:
    sw zero, 0(t0)
    addi t0, t0, 4
    blt t0, t1, 1b

    # 设置机器模式trap handler
    la t0, trap_entry
    csrw mtvec, t0

    # 启用中断
    li t0, 0x888  # MIE.MEIE | MIE.MTIE | MIE.MSIE
    csrs mie, t0

    # 跳转到C代码
    call freertos_main

_hang:
    wfi
    j _hang
```

**FreeRTOS主函数**（main.c）：
```c
// 共享内存仅描述布局；同步由平台适配层实现
#define SHARED_MEM_BASE 0xC0000000
struct shared_mailbox {
    uint32_t cmd;
    uint32_t len;
    uint32_t data[15];
    uint32_t status;
} *mailbox = (void*)SHARED_MEM_BASE;

// 实时控制任务
void control_task(void *pvParameters) {
    while (1) {
        // doorbell ISR 通过 task notification 唤醒任务
        ulTaskNotifyTake(pdTRUE, portMAX_DELAY);

        platform_shared_acquire();
        if (mailbox->status != CMD_READY || mailbox->len > sizeof(mailbox->data))
            continue;

        // 执行实时控制
        uint32_t cmd = mailbox->cmd;
        execute_control_command(cmd, mailbox->data);

        // 返回结果
        mailbox->status = CMD_DONE;
        platform_shared_release();

        // M-mode FreeRTOS不调用SBI；使用平台mailbox/doorbell通知Linux
        platform_doorbell_raise(LINUX_ENDPOINT);
    }
}

void freertos_main(void) {
    // 初始化FreeRTOS
    xTaskCreate(control_task, "Control",
                1024, NULL, tskIDLE_PRIORITY + 2, NULL);

    // 启动调度器（永不返回）
    vTaskStartScheduler();

    // 不应该到这里
    while (1);
}
```

---

## 四、关键技术点

### 4.1 PMP隔离

**问题**：如何防止Linux访问FreeRTOS内存？

**方案**：使用PMP（Physical Memory Protection）

**PMP寄存器**：
```
pmpcfg0-3:  配置寄存器（R/W/X权限）
pmpaddr0-15: 地址寄存器（物理地址范围）
```

PMP 是 per-hart 配置。Linux harts 的 S/U-mode 需要显式允许 Linux RAM 和共享区、拒绝 RTOS 私有区；hart7 则由专用启动路径配置自己的低特权访问策略。PMP 默认不约束 M-mode 访问，除非使用 lock bit 或平台支持的 ePMP，因此“RTOS 运行在 M-mode”与“PMP 自动限制 RTOS”不能同时假设。

TOR entry `i` 的下界来自 `pmpaddr[i-1]`、上界来自 `pmpaddr[i]`，最低编号的匹配 entry 生效。应使用 OpenSBI domain region 或经审查的平台 helper，一次组合完整配置并逐 hart 读回验证；不要多次覆盖 `pmpcfg0`，也不要照搬容易意外开放 `0..address` 的手写 CSR 片段。

**验证**：
```c
// 在Linux中尝试访问FreeRTOS内存
void *ptr = ioremap(0xC0100000, 4096);
*((int*)ptr) = 0x1234;  // ❌ 触发PMP异常！

// 内核日志：
// [  10.123] PMP violation: hart0 tried to access 0xc0100000
```

---

### 4.2 hart间通信（共享内存 + doorbell）

**问题**：Linux如何通知FreeRTOS？

**方案**：使用平台 mailbox/doorbell 中断。若两个端点都位于同一 OpenSBI domain 且运行于 S-mode，也可以使用 SBI IPI；本文的 M-mode FreeRTOS 不调用 SBI。

**通信协议**：
```
1. Linux写入命令到共享内存
2. Linux通过平台doorbell通知hart7
3. FreeRTOS在中断中读取命令
4. FreeRTOS执行命令，写入结果
5. FreeRTOS通过平台doorbell通知Linux端点
6. Linux在中断中读取结果
```

**Linux端驱动**（rpmsg_riscv.c）：
```c
// 发送命令到FreeRTOS
int send_command_to_freertos(uint32_t cmd, void *data, size_t len) {
    struct shared_mailbox *mbox = ioremap(0xC0000000, 4096);

    if (len > sizeof(mbox->data))
        return -EMSGSIZE;

    // 等待上一个命令完成
    while (mbox->status == CMD_BUSY) {
        cpu_relax();
    }

    // 写入命令
    mbox->cmd = cmd;
    mbox->len = len;
    memcpy((void*)mbox->data, data, len);
    dma_wmb();  // 非一致平台还需要对应的cache clean
    mbox->status = CMD_READY;

    platform_doorbell_raise(RTOS_ENDPOINT);

    // 等待完成
    while (mbox->status != CMD_DONE) {
        cpu_relax();
    }

    return 0;
}

// doorbell中断处理
static irqreturn_t rtos_doorbell_handler(int irq, void *dev) {
    platform_doorbell_clear(LINUX_ENDPOINT);
    dma_rmb();
    // FreeRTOS完成了命令
    complete(&rpmsg_completion);
    return IRQ_HANDLED;
}
```

**FreeRTOS端**（平台适配层）：
```c
void platform_doorbell_handler(void) {
    BaseType_t wake = pdFALSE;

    platform_doorbell_clear(RTOS_ENDPOINT);
    platform_shared_acquire();
    vTaskNotifyGiveFromISR(control_task_handle, &wake);
    portYIELD_FROM_ISR(wake);
}
```

`volatile` 不能提供跨 hart 内存顺序。发布命令前需要 release fence，消费前需要 acquire fence；非一致缓存系统还要在两端执行匹配的 cache clean/invalidate。ACLINT/CLINT 软件中断通常通过对应 hart 的 MMIO `msip` 清除，不能笼统地写 `mip` CSR，因此清除动作必须封装在平台回调中。

---

### 4.3 调试技巧

**问题1：如何调试8个hart？**

**方案**：JTAG + GDB多线程调试

```bash
# OpenOCD配置
interface ftdi
ftdi_vid_pid 0x0403 0x6010

# 8个hart
set _CHIPNAME riscv
set _TARGETNAME $_CHIPNAME.cpu

# 创建8个target
target create $_TARGETNAME.0 riscv -chain-position $_TARGETNAME
target create $_TARGETNAME.1 riscv -chain-position $_TARGETNAME
# ... target 2-7

# GDB连接
target extended-remote localhost:3333

# 切换到hart7
thread 8

# 设置断点
break freertos_main
continue
```

---

**问题2：如何查看每个hart在做什么？**

**方案**：ftrace + perf

```bash
# 开启调度追踪
echo 1 > /sys/kernel/debug/tracing/events/sched/enable

# 查看每个CPU的调度
cat /sys/kernel/debug/tracing/per_cpu/cpu0/trace
cat /sys/kernel/debug/tracing/per_cpu/cpu6/trace

# hart7在FreeRTOS中，Linux看不到
```

---

## 五、性能测试

### 5.1 通信延迟测试

**测试代码**：
```c
// Linux端
for (int i = 0; i < 10000; i++) {
    uint64_t start = rdcycle();
    send_command_to_freertos(CMD_PING, NULL, 0);
    uint64_t end = rdcycle();

    latencies[i] = (end - start) * 1000000 / CPU_FREQ_HZ;  // us
}

// 统计延迟分布
sort(latencies, 10000);
printf("P50:   %lu us\n", latencies[5000]);
printf("P99:   %lu us\n", latencies[9900]);
printf("P99.9: %lu us\n", latencies[9990]);
```

这些延迟数字来自案例稿，公开仓库没有对应固件、时钟频率、缓存属性、doorbell 实现和原始样本，因此不能作为复现结果。正式报告需要给出 round-trip 定义、计时器、样本数、负载、cache maintenance、P50/P99/P99.9/Max 与超时次数。

---

### 5.2 实时性验证

**FreeRTOS任务延迟**：
```c
// 测量doorbell ISR到控制任务开始执行的唤醒延迟
void benchmark_task(void *param) {
    for (int i = 0; i < 10000; i++) {
        ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
        uint64_t task_start = read_mcycle();
        record_latency(task_start - isr_timestamp[i]);
    }
}
```

`vTaskDelay(1)` 测的是 tick 阻塞与唤醒总时间，不是任务切换延迟。是否满足 deadline 必须在目标硬件最坏负载、中断和缓存条件下测量 WCET 与尾延迟。

---

## 六、经验总结

### 6.1 异构多核架构的优势

- **故障隔离**：独立 hart 和内存域可限制部分故障传播，但共享 DRAM、时钟、中断控制器和平台固件仍是共同依赖
- **调度隔离**：hart7 不受 Linux 调度器直接干扰；FreeRTOS、中断、缓存和总线竞争仍会影响 deadline
- **资源边界清晰**：hart 分配在启动时固定，动态重分配需要完整的停机、状态迁移与安全协议

---

### 6.2 常见坑点

**坑1：把 Device Tree 属性当作缓存一致性开关**

参与硬件一致性通常意味着共享写入更容易互相可见，而不是“Linux 修改后 hart7 看不到”。`no-map` 只限制 Linux 的常规映射，`dma-coherent` 是对平台一致性能力的声明，不会凭空强制一致。两端必须使用兼容的内存属性；非一致系统需要显式 cache clean/invalidate 与 acquire/release barrier。

**坑2：忽略 PMP entry 的匹配优先级**

PMP 不是笼统的“先大后小”，而是最低编号的匹配 entry 生效。要在大区域内设置例外，通常需要让更具体的区域获得更高匹配优先级，并严格核对 TOR/NAPOT 编码、lock/ePMP 语义和每个 hart 的配置。

**坑3：把通知延迟写成“中断丢失”**

低优先级通知通常表现为延迟或饥饿，不会自动丢失。中断编号、claim/complete、优先级编码和 FreeRTOS 可调用 API 的阈值均取决于平台；应记录 pending/claim 状态和服务延迟，不能套用一个通用的“优先级 0 最高”宏。

---

### 6.3 后续优化方向

1. **共享内存协议**：加入序号、长度、超时、恢复和 cache maintenance
2. **静态资源预算**：测量 DRAM/缓存/中断控制器的跨域干扰
3. **虚拟化**：使用H-extension支持更多OS

---

## 七、总结

本文给出一条不混用特权级职责的 7+1 设计路线：平台固件把 hart0-6 交给 OpenSBI/Linux，把 hart7 交给 M-mode FreeRTOS；PMP 按 hart 配置，跨域通信使用共享内存与平台 doorbell。是否达到硬实时 deadline，仍需在目标硬件、最坏负载和完整中断条件下验证。

**关键技术**：
- PMP物理内存隔离
- 平台 mailbox/doorbell 通知
- 共享内存 + 内存屏障/cache maintenance

**适用场景**：
- 工业机器人（Linux负责规划，RTOS负责控制）
- 汽车电子（RTOS负责安全关键任务）
- 航空航天（硬实时 + 通用计算）

---

## 参考资料

- [OpenSBI Domain 支持](https://github.com/riscv-software-src/opensbi/blob/master/docs/domain_support.md)
- [RISC-V SBI HSM 扩展](https://github.com/riscv-non-isa/riscv-sbi-doc/blob/master/src/ext-hsm.adoc)
- [RISC-V SBI IPI 扩展](https://github.com/riscv-non-isa/riscv-sbi-doc/blob/master/src/ext-ipi.adoc)
- [RISC-V 特权架构 PMP](https://docs.riscv.org/reference/isa/priv/machine.html)
- [Linux 内存屏障](https://docs.kernel.org/core-api/wrappers/memory-barriers.html)
