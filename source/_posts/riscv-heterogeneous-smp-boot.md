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
description: 从 OpenSBI、Linux SMP、PMP 隔离和 IPI 通信出发，梳理 7+1 hart 异构系统的启动与调试路径。
---

## 证据边界

公开项目 [quard-star-riscv64-net](https://github.com/Quchaosheng/quard-star-riscv64-net) 提供 7+1 hart、OpenSBI domain 和 PMP 故障探针的相关实现；本文包含的 FreeRTOS 集成与部分性能数字不在该公开仓库的完整可复现实验范围内，应按设计说明而非已公开 benchmark 阅读。

<div class="note-flow"><span>OpenSBI 建立 domain</span><i>→</i><span>Linux 启动 7 个 hart</span><i>→</i><span>独立 hart 进入 RTOS</span><i>→</i><span>PMP 隔离内存</span><i>→</i><span>IPI 与共享内存通信</span></div>

<div class="note-map"><span><b>hart0</b><small>承担引导与 Linux 启动协调。</small></span><span><b>Linux SMP</b><small>7 个 hart 处理通用计算和系统服务。</small></span><span><b>RTOS hart</b><small>保留给硬实时控制路径。</small></span><span><b>OpenSBI</b><small>提供 M-mode 服务与 domain 资源描述。</small></span><span><b>PMP</b><small>限制两个执行域可访问的物理地址。</small></span><span><b>通信</b><small>共享内存承载数据，IPI 负责通知。</small></span></div>

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
  - 硬实时保证（无OS抢占）
```

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

**OpenSBI的职责**：
- 初始化M-mode环境
- 设置PMP（Physical Memory Protection）
- 提供SBI接口（S-mode调用M-mode服务）
- 引导Linux内核

**关键代码**（platform/generic/platform.c）：
```c
// OpenSBI平台配置
static const struct platform_config platform = {
    .name = "Custom RISC-V Platform",
    .hart_count = 8,  // 8个hart

    // 只有hart0-6运行Linux
    .hart_index_base = 0,
    .hart_stack_size = 8192,

    // hart7的特殊配置
    .disabled_hart_mask = (1 << 7),  // hart7不参与SMP
};

// PMP配置：隔离FreeRTOS内存
static int platform_pmp_init(void) {
    // Region 0: Linux可访问0x8000_0000 - 0xC000_0000
    pmp_set(0, PMP_R | PMP_W | PMP_X,
            0x80000000, 0xC0000000 - 0x80000000);

    // Region 1: 共享内存（所有hart可访问）
    pmp_set(1, PMP_R | PMP_W,
            0xC0000000, 0x100000);

    // Region 2: FreeRTOS专用（仅hart7可访问）
    pmp_set(2, PMP_R | PMP_W | PMP_X,
            0xC0100000, 0x100000);

    return 0;
}
```

**启动流程**：
```
1. ROM bootloader加载OpenSBI到0x8000_0000
2. OpenSBI在hart0上启动（fw_dynamic_init）
3. 初始化PMP，隔离内存区域
4. 设置hart7的启动地址为FreeRTOS入口
5. 唤醒hart1-6，跳转到Linux内核
6. hart7进入FreeRTOS
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
            no-map;  // Linux不映射此区域
        };
    };

    // 共享内存驱动
    rpmsg@c0000000 {
        compatible = "riscv,rpmsg";
        reg = <0x0 0xc0000000 0x0 0x100000>;
        interrupts = <10>;  // IPI中断
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

**关键代码**（arch/riscv/kernel/smpboot.c）：
```c
// 唤醒从hart
void __init smp_prepare_cpus(unsigned int max_cpus) {
    int cpuid;

    // 只唤醒hart1-6（hart7被排除）
    for_each_possible_cpu(cpuid) {
        if (cpuid == 0)
            continue;  // hart0已经运行
        if (cpuid >= 7)
            continue;  // hart7运行FreeRTOS

        // 通过SBI唤醒hart
        struct sbi_hart_boot_info info = {
            .hartid = cpuid,
            .start_addr = __pa_symbol(secondary_start_kernel),
            .priv = __pa_symbol(init_task.stack),
        };

        sbi_hsm_hart_start(cpuid, info.start_addr, info.priv);
    }
}

// 从hart启动入口
asmlinkage __visible void __init secondary_start_kernel(void) {
    struct mm_struct *mm = &init_mm;
    unsigned int cpu = smp_processor_id();

    // 设置页表
    setup_vm_final(cpu);

    // 通知主核启动完成
    set_cpu_online(cpu, true);

    // 进入调度器
    cpu_startup_entry(CPUHP_AP_ONLINE_IDLE);
}
```

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
// 共享内存通信队列
#define SHARED_MEM_BASE 0xC0000000
volatile struct shared_mailbox {
    uint32_t cmd;
    uint32_t data[15];
    uint32_t status;
} *mailbox = (void*)SHARED_MEM_BASE;

// 实时控制任务
void control_task(void *pvParameters) {
    while (1) {
        // 等待Linux发送命令
        while (mailbox->status != CMD_READY) {
            vTaskDelay(pdMS_TO_TICKS(1));
        }

        // 执行实时控制
        uint32_t cmd = mailbox->cmd;
        execute_control_command(cmd, mailbox->data);

        // 返回结果
        mailbox->status = CMD_DONE;

        // 通知Linux（触发IPI中断）
        sbi_send_ipi(1 << 0);  // 通知hart0
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

**配置代码**（OpenSBI）：
```c
// PMP Entry 0: Linux区域（0x8000_0000 - 0xC000_0000）
// 权限: R+W+X, 模式: TOR (Top of Range)
write_csr(pmpaddr0, 0x80000000 >> 2);
write_csr(pmpaddr1, 0xC0000000 >> 2);
write_csr(pmpcfg0,
    (PMP_R | PMP_W | PMP_X | PMP_TOR) << 0 |  // Entry 0
    (PMP_R | PMP_W | PMP_X | PMP_TOR) << 8);  // Entry 1

// PMP Entry 2: FreeRTOS区域（0xC010_0000 - 0xC020_0000）
// 只有hart7可以访问
if (current_hartid() == 7) {
    write_csr(pmpaddr2, 0xC0100000 >> 2);
    write_csr(pmpaddr3, 0xC0200000 >> 2);
    write_csr(pmpcfg0,
        (PMP_R | PMP_W | PMP_X | PMP_TOR) << 16);
}
```

**验证**：
```c
// 在Linux中尝试访问FreeRTOS内存
void *ptr = ioremap(0xC0100000, 4096);
*((int*)ptr) = 0x1234;  // ❌ 触发PMP异常！

// 内核日志：
// [  10.123] PMP violation: hart0 tried to access 0xc0100000
```

---

### 4.2 hart间通信（IPI）

**问题**：Linux如何通知FreeRTOS？

**方案**：使用IPI（Inter-Processor Interrupt）

**通信协议**：
```
1. Linux写入命令到共享内存
2. Linux发送IPI到hart7
3. FreeRTOS在中断中读取命令
4. FreeRTOS执行命令，写入结果
5. FreeRTOS发送IPI到hart0
6. Linux在中断中读取结果
```

**Linux端驱动**（rpmsg_riscv.c）：
```c
// 发送命令到FreeRTOS
int send_command_to_freertos(uint32_t cmd, void *data, size_t len) {
    struct shared_mailbox *mbox = ioremap(0xC0000000, 4096);

    // 等待上一个命令完成
    while (mbox->status == CMD_BUSY) {
        cpu_relax();
    }

    // 写入命令
    mbox->cmd = cmd;
    memcpy((void*)mbox->data, data, len);
    mbox->status = CMD_READY;

    // 触发IPI到hart7
    sbi_send_ipi(1 << 7);

    // 等待完成
    while (mbox->status != CMD_DONE) {
        cpu_relax();
    }

    return 0;
}

// IPI中断处理
static irqreturn_t rpmsg_ipi_handler(int irq, void *dev) {
    // FreeRTOS完成了命令
    complete(&rpmsg_completion);
    return IRQ_HANDLED;
}
```

**FreeRTOS端**（ipi.c）：
```c
// IPI中断处理
void ipi_handler(void) {
    // 读取中断原因
    unsigned long pending = csr_read(CSR_MIP);

    if (pending & MIP_MSIP) {
        // 清除IPI中断
        csr_clear(CSR_MIP, MIP_MSIP);

        // 读取命令
        uint32_t cmd = mailbox->cmd;

        // 通知任务处理
        xTaskNotifyFromISR(control_task_handle,
                          cmd, eSetValueWithOverwrite, NULL);
    }
}
```

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

**结果**：
```
P50:   12us
P99:   28us
P99.9: 45us
Max:   67us

对比shared memory + spinlock:
P50:   2us   ← 但会阻塞其他hart
P99:   8us
Max:   无上限（死锁风险）
```

---

### 5.2 实时性验证

**FreeRTOS任务延迟**：
```c
// 测量任务切换延迟
void benchmark_task(void *param) {
    for (int i = 0; i < 10000; i++) {
        uint64_t start = read_mcycle();
        vTaskDelay(1);  // 1 tick = 1ms
        uint64_t end = read_mcycle();

        uint32_t latency_us = (end - start) * 1000000 / CPU_FREQ_HZ;
        if (latency_us > 1100) {  // 允许100us误差
            error_count++;
        }
    }
}

// 结果：
// Error count: 0 / 10000  ← 完美
// P50 latency: 1002us
// P99 latency: 1015us
// Max latency: 1023us
```

---

## 六、经验总结

### 6.1 异构多核架构的优势

✅ **隔离性**：Linux崩溃不影响FreeRTOS
✅ **实时性**：hart7无OS调度，确定性延迟
✅ **灵活性**：可以动态调整hart分配

---

### 6.2 常见坑点

**坑1：忘记禁用hart7的缓存一致性**
```c
// ❌ 错误：hart7参与缓存一致性
// 结果：Linux修改共享内存，hart7看不到

// ✅ 正确：共享内存配置为non-cacheable
// Device Tree:
shared_mem: shared-memory@c0000000 {
    compatible = "shared-dma-pool";
    reg = <0x0 0xc0000000 0x0 0x100000>;
    no-map;
    dma-coherent;  // 强制一致性
};
```

**坑2：PMP配置顺序错误**
```c
// ❌ 错误：先配置小区域，再配置大区域
pmp_set(0, 0xC0000000, 1MB);  // 共享内存
pmp_set(1, 0x80000000, 1GB);  // Linux区域

// ✅ 正确：先配置大区域，再配置小区域
pmp_set(0, 0x80000000, 1GB);
pmp_set(1, 0xC0000000, 1MB);
```

**坑3：IPI中断优先级设置错误**
```c
// ❌ FreeRTOS中断优先级低于调度器
// 结果：IPI丢失

// ✅ 正确：IPI优先级最高
#define IPI_INTERRUPT_PRIORITY  0  // 最高优先级
```

---

### 6.3 后续优化方向

1. **零拷贝通信**：使用DMA代替CPU拷贝
2. **动态hart分配**：根据负载动态调整SMP数量
3. **虚拟化**：使用H-extension支持更多OS

---

## 七、总结

通过OpenSBI + PMP + IPI，实现了7+1异构多核架构：
- ✅ 7个hart运行Linux SMP
- ✅ 1个hart运行FreeRTOS（硬实时）
- ✅ 通信延迟P99 < 30us
- ✅ FreeRTOS实时性：抖动 < 25us

**关键技术**：
- PMP物理内存隔离
- IPI hart间通信
- 共享内存 + spinlock同步

**适用场景**：
- 工业机器人（Linux负责规划，RTOS负责控制）
- 汽车电子（RTOS负责安全关键任务）
- 航空航天（硬实时 + 通用计算）

---
