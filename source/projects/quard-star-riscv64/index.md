---
title: Quard Star RISC-V64
date: 2026-07-30 16:06:00
layout: page
description: 面向自定义 QEMU quard-star 机器的 RISC-V64 SMP 内核、FreeRTOS trusted hart、VirtIO 与 PMP 隔离项目。
cover: /image/projects/quard-qemu.png
---

<div class="page-lead"><p class="section-kicker">项目说明</p><p>Quard Star RISC-V64 是一个 RISC-V64 SMP 操作系统项目。七个普通 hart 运行自写的 C 内核，一个独立 FreeRTOS hart 运行在受限域中；OpenSBI、VirtIO、FatFs、TCP/IP 和 PMP 分别负责启动、设备、存储、网络和隔离。</p></div>

<figure class="project-hero-image"><img src="/image/projects/quard-qemu.png" alt="Quard Star RISC-V64 的 QEMU 验收演示"></figure>

<div class="project-facts"><div><span>目标机器</span><strong>QEMU quard-star · 8 RISC-V64 harts</strong></div><div><span>域划分</span><strong>7-hart SMP kernel · 1 FreeRTOS trusted hart</strong></div><div><span>验收环境</span><strong>QEMU · TAP · 本地确定性协议对端</strong></div></div>

## 启动时怎么分工

<div class="note-flow"><span>QEMU reset<br>8 harts</span><i>→</i><span>OpenSBI<br>domain + PMP</span><i>→</i><span>普通内核<br>harts 0-6</span><i>→</i><span>FreeRTOS<br>trusted hart 7</span><i>→</i><span>VirtIO / TAP<br>本地验收</span></div>

hart 7 不加入普通内核的 allocator、scheduler、locks、interrupt routing 或 network stack。普通域和 trusted 域通过 OpenSBI domain 与 PMP 看到不同的内存和设备；测试会检查双向拒绝访问和 trusted scheduler 的标记。

## 仓库里有什么

<div class="note-map"><span><b>普通内核</b><small>Sv39、每 hart 状态、调度、迁移、trap、timer、syscall 和同步原语。</small></span><span><b>启动与隔离</b><small>OpenSBI HSM、TIME、IPI、domain 配置和 PMP 边界。</small></span><span><b>存储</b><small>VirtIO MMIO/virtqueue、block、FatFs 和带 generation 的文件句柄。</small></span><span><b>网络</b><small>VirtIO net、ARP、IPv4、ICMP、UDP、TCP、loopback 和 sockets。</small></span><span><b>可信运行时</b><small>hart 7 的 FreeRTOS S-mode scheduler、trusted RAM、UART2 和 SBI timer tick。</small></span><span><b>测试输出</b><small>serial markers、QEMU/TAP smoke、host test、日志和性能报告。</small></span></div>

## 先跑一次

```bash
git clone --recurse-submodules \
  https://github.com/Quchaosheng/quard-star-riscv64-net.git
cd quard-star-riscv64-net
make check-env
make deps
make test-host
make m8-build
sudo -v
make m8-smoke
```

成功时，`kernel.log`、`trusted.log`、`qemu.log`、`qemu.err` 和 `m5-peer.stats` 会保存在 `out/m8`。通过标记是 `QS:TEST_PASS:m8-smoke`；出现 `QS:TEST_FAIL` 时，后续输出不算通过。

## 这能说明什么

- 在 QEMU/TAP 中可以复现 SMP、存储、网络、应用协议、trusted scheduling 和 PMP 双向拒绝访问。
- 仓库里的 QEMU demo 由通过的 M8 输出生成，并附有日志和媒体哈希。
- 当前安全、时序和性能结论只适用于 QEMU 模型；真实板卡上的中断、内存、设备、固件和性能还要重新测。

它适合用来学习系统结构和 QEMU 测试，不是对真实 RISC-V 硬件的性能或安全认证。

**链接：** [GitHub 源码、测试输出与文档](https://github.com/Quchaosheng/quard-star-riscv64-net)
