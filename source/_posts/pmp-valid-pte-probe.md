---
title: 为什么我给 PMP 探针配了一个合法的页表映射
date: 2026-08-08 09:30:00
allow_future: true
permalink: /2026/08/08/pmp-valid-pte-probe/
categories: [技术, RISC-V]
tags: [RISC-V, OpenSBI, PMP, Sv39, QEMU]
---

我想验证普通 S 模式内核不能访问 trusted RAM。第一次描述这个测试时，我很快发现“访问失败了”并不能证明 PMP 生效。缺页、PTE 权限错误、地址未映射和 PMP 拒绝都会触发异常。若探针只等一个 trap，它最多证明某一层拒绝了访问。

为了让结论收敛到 PMP，我故意给探针安装了一条合法的 Sv39 映射。

<div class="note-flow"><span>映射探针 VA</span><i>→</i><span>完成 Sv39 翻译</span><i>→</i><span>触发 R/W/X 访问</span><i>→</i><span>核对 scause/stval</span></div>

<figure class="note-visual"><figcaption><span>先排除页表</span>合法 PTE 让访问穿过分页，随后由 PMP 成为拒绝点。</figcaption><div class="note-map"><span><b>VA</b><small>0x40000000，独立探针入口。</small></span><span><b>PTE</b><small>有效映射并打开 R/W/X。</small></span><span><b>PA</b><small>0xbf800000，trusted RAM。</small></span><span><b>异常</b><small>分别匹配读、写、取指 access fault。</small></span></div></figure>

## 先让分页成功

当前系统把 trusted RAM 放在 `0xbf800000-0xbfffffff`。普通 domain 对这段物理地址没有权限。我从普通内核使用虚拟地址 `0x40000000`，将它映射到 trusted RAM 的第一页 `0xbf800000`，叶子 PTE 同时打开 R、W、X：

```text
VA 0x40000000
  -> valid Sv39 PTE, R/W/X
  -> PA 0xbf800000
  -> PMP protected trusted RAM
```

`kernel/src/address.c` 在 `QS_M9_PMP_TEST` 下调用 `PageTable_map()` 建立这条映射。这样地址翻译和 PTE 权限都不是失败原因。读、写、取指仍然失败时，PMP 才成为符合当前配置的解释。

如果我省掉映射，访问更可能得到 page fault。RISC-V 中 instruction/load/store page fault 通常对应 12、13、15，而探针期待的是 instruction/load/store access fault 1、5、7。二者不能混为一谈。

## 只看 scause 仍然不够

trap handler 不能看到 access fault 就宣布成功。内核里任何无关错误都可能产生同类异常。我给每次探测记录三个条件：

1. 探针已经处于 armed 状态。
2. `scause` 与本次读、写或取指的预期类型一致。
3. `stval` 必须等于探针地址 `0x40000000`。

只有三项同时成立，handler 才写回恢复 PC，并把状态改为 faulted。cause 或地址不匹配时，异常继续走通用 trap 路径，最后 panic。测试不会吞掉一个与 PMP 无关的内核错误。

## 没被拒绝也必须失败

隔离测试还有一个容易漏掉的分支：访问没有产生异常。如果指令顺利执行并落到恢复标签，状态仍然是 armed。此时代码打印 `QS:PMP_UNTRUSTED_DENY_FAIL`，随后执行：

```c
panic("trusted memory access was not denied");
```

这条失败路径很重要。否则一次未被拒绝的访问可能继续运行到绿色终态，让最危险的结果静默通过。

主机合同测试检查有效 R/W/X 映射、三类 access-fault 常量、handler 接线和日志标记。QEMU M8 smoke 还要求日志中同时出现三项拒绝标记、汇总标记，以及 OpenSBI 对两个 domain 的区域权限打印：

```bash
bash tests/host/test_m8_contracts.sh
sudo make m8-smoke
```

这套探针的设计重点不是“成功触发异常”，而是先排除页表失败，再绑定异常类型、故障地址和恢复点。完整实现可在 [Quard 提交 d995e31](https://github.com/Quchaosheng/quard-star-riscv64-net/commit/d995e31335bea05669d3313d6023ff5de413943c) 中复核。

**证据边界：**结果止于当前 QEMU RISC-V 模型、OpenSBI domain/PMP 配置、Sv39 页表和内核 trap 路径。它不是物理芯片安全认证，也不覆盖 DMA、总线主设备、缓存侧信道或 PMP 硬件缺陷。
