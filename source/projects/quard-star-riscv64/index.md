---
title: Quard Star RISC-V64
date: 2026-07-30 16:06:00
layout: page
description: 面向自定义 QEMU quard-star 机器的 RISC-V64 SMP 内核、FreeRTOS trusted hart、VirtIO 与 PMP 隔离项目。
cover: /image/projects/quard-qemu.png
---

<div class="page-lead"><p class="section-kicker">PROJECT DOSSIER</p><p>Quard Star RISC-V64 是一个教育性的 RISC-V64 SMP 操作系统项目：七个普通 hart 运行自主实现的 C 内核，一个独立 FreeRTOS hart 运行在受限域中；系统通过 OpenSBI 域、VirtIO、FatFs、TCP/IP 和 PMP 规则组织启动、网络、存储与隔离。</p></div>

<figure class="project-hero-image"><img src="/image/projects/quard-qemu.png" alt="Quard Star RISC-V64 的 QEMU 验收演示"></figure>

<div class="project-facts"><div><span>目标机器</span><strong>QEMU quard-star · 8 RISC-V64 harts</strong></div><div><span>域划分</span><strong>7-hart SMP kernel · 1 FreeRTOS trusted hart</strong></div><div><span>验收环境</span><strong>QEMU · TAP · 本地确定性协议对端</strong></div></div>

## 启动与隔离结构

<div class="note-flow"><span>QEMU reset<br>8 harts</span><i>→</i><span>OpenSBI<br>domain + PMP</span><i>→</i><span>普通内核<br>harts 0-6</span><i>→</i><span>FreeRTOS<br>trusted hart 7</span><i>→</i><span>VirtIO / TAP<br>本地验收</span></div>

hart 7 不加入普通内核的 allocator、scheduler、locks、interrupt routing 或 network stack。普通域和 trusted 域通过 OpenSBI domain 与 PMP 获得不同的内存/设备视图；测试重点是双向拒绝访问和 trusted scheduler 的稳定标记，而不是只展示系统启动。

## 已实现的系统范围

<div class="note-map"><span><b>普通内核</b><small>Sv39、每 hart 状态、调度、迁移、trap、timer、syscall 与同步原语。</small></span><span><b>启动与隔离</b><small>OpenSBI HSM、TIME、IPI、domain 配置与 PMP 边界。</small></span><span><b>存储</b><small>共享 VirtIO MMIO/virtqueue、block、FatFs 与带 generation 的文件句柄。</small></span><span><b>网络</b><small>VirtIO net、ARP、IPv4、ICMP、UDP、TCP、loopback 与 sockets。</small></span><span><b>可信运行时</b><small>hart 7 的 FreeRTOS S-mode scheduler、trusted RAM、UART2 与 SBI timer tick。</small></span><span><b>验收工件</b><small>serial markers、QEMU/TAP smoke、host test、日志与性能报告。</small></span></div>

## 最小验收命令

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

成功路径会把 `kernel.log`、`trusted.log`、`qemu.log`、`qemu.err` 与 `m5-peer.stats` 保存到 `out/m8`。通过标记是 `QS:TEST_PASS:m8-smoke`；任何 `QS:TEST_FAIL` 都优先于后续输出。

## 证据边界

- **可复现证据：** QEMU/TAP 环境中的 SMP、存储、网络、应用协议、trusted scheduling 和 PMP 双向拒绝访问。
- **回放证据：** 仓库中的 QEMU demo 由通过的 M8 工件渲染，并带来源日志和媒体哈希说明。
- **不能外推：** 当前安全、时序与性能结论适用于 QEMU 模型；真实板卡的中断、内存、设备、固件和性能特征需要重新测量。

因此，这个项目适合作为系统结构和可审计 QEMU 验收的证据，不应被描述为真实 RISC-V 硬件的性能或安全认证。

**入口：** [GitHub 源码、验收工件与文档](https://github.com/Quchaosheng/quard-star-riscv64-net) · [证据日志](/evidence/) · [实验记录模板](/evidence/template/)
