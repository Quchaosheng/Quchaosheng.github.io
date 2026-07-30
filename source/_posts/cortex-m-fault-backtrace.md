---
title: Cortex-M 故障回溯：从 HardFault 找到出错代码
date: 2026-06-11 14:00:00
permalink: /2026/07/29/cortex-m-fault-backtrace/
categories: [技术, 嵌入式]
tags: [HardFault, Cortex-M, CmBacktrace]
---

HardFault 不是根因，而是 Cortex-M 无法继续执行时交给你的最后一份现场。异常入口会自动保存一部分寄存器；故障处理程序只要把这份栈帧、SCB 状态寄存器和固件版本保存下来，通常就能把“设备偶尔死机”缩小到具体的指令地址和访问类型。

<div class="note-flow"><span>CPU 进入 HardFault</span><i>→</i><span>识别 MSP/PSP 栈帧</span><i>→</i><span>保存寄存器和故障状态</span><i>→</i><span>地址映射到符号</span><i>→</i><span>复现并修复根因</span></div>

<figure class="note-visual"><figcaption><span>故障现场</span>先保存能定位问题的最小集合，再考虑打印日志。</figcaption><div class="note-map"><span><b>stacked PC</b><small>异常发生前后正在执行的位置，是符号化的起点。</small></span><span><b>LR 与 xPSR</b><small>帮助判断调用返回位置和异常执行状态。</small></span><span><b>CFSR</b><small>区分内存管理、总线和用法错误。</small></span><span><b>HFSR</b><small>说明 HardFault 是否由其他可配置故障升级而来。</small></span><span><b>BFAR/MMFAR</b><small>当对应状态位有效时，记录发生错误的地址。</small></span><span><b>固件标识</b><small>没有 ELF、版本和构建信息，地址很难可靠还原。</small></span></div></figure>

## 先判断异常使用了哪一个栈

线程模式可能使用 PSP，异常和启动代码常用 MSP。HardFault 包装函数需要根据 `EXC_RETURN` 判断自动压栈的寄存器帧来自哪个栈，再把其中的 `pc`、`lr`、`xpsr` 复制到可靠的存储区域。只打印处理函数自己的调用栈，往往看不到真正出错的任务。

保存后可以用与固件完全匹配的 ELF 解析地址：

```bash
arm-none-eabi-addr2line -e firmware.elf -f -C 0x08001234
```

地址、优化级别和符号文件必须对应同一次构建。若使用了 bootloader 或链接脚本重定位，也要先确认记录的 PC 是逻辑地址还是实际映射地址。

## 异常处理路径越短越好

故障处理程序不应申请堆内存、等待锁、访问可能已经坏掉的外设驱动，也不要依赖串口日志一定能发出去。更稳妥的是把寄存器、状态和少量栈内容写进保留 RAM 或预先准备好的 Flash 槽，随后复位；下一次启动再把转储上传并符号化。这样一次二次故障不会把唯一的线索冲掉。

参考：[CmBacktrace](https://github.com/armink/CmBacktrace)
