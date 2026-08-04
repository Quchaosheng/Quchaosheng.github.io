---
title: OpenSBI domain 与 PMP：用 DTS 声明隔离，用异常探针证明隔离
date: 2026-09-19 09:30:00
allow_future: true
permalink: /2026/09/19/opensbi-domain-pmp-access-probes/
categories: [技术, RISC-V]
tags: [OpenSBI, PMP, RISC-V, DTS, QEMU]
---

“你实现了 PMP 隔离吗？”这是一个很容易答错的问题。若回答“我在 S 模式内核里写了 `pmpaddr`”，面试官马上会追问特权级；若只回答“DTS 里配置了权限”，又像是把配置文件当成了运行证据。更准确的说法是：我编写 OpenSBI domain 的 DTS 策略和访问探针，由运行在 M 模式的 OpenSBI 根据配置完成 PMP 资源编程，再用 QEMU 启动日志和 S 模式异常结果交叉验证隔离是否实际生效。

这篇文章只讨论仓库里已经能解释的 QEMU/固件链路，不把它扩展成物理硬件安全证明，也不声称第一方代码直接实现了所有 PMP 寄存器写入。

<div class="note-flow"><span>DTS 声明 domain</span><i>→</i><span>OpenSBI 解析资源</span><i>→</i><span>M 模式编程 PMP</span><i>→</i><span>S 模式运行探针</span><i>→</i><span>校验 scause/stval</span><i>→</i><span>对账固件日志</span></div>

<figure class="note-visual"><figcaption><span>隔离证据不是一行配置</span>声明、执行和验证必须在不同层次留下彼此可对照的证据。</figcaption><div class="note-map"><span><b>DTS</b><small>描述 domain、内存区域、设备和 hart 归属。</small></span><span><b>OpenSBI</b><small>在 M 模式读取 domain 配置并建立固件侧资源。</small></span><span><b>PMP</b><small>把区域权限落实为 load/store/execute 访问边界。</small></span><span><b>探针</b><small>从 S 模式访问目标地址，等待预期异常。</small></span><span><b>scause</b><small>确认异常类型属于访问拒绝，而不是其他故障。</small></span><span><b>stval</b><small>确认异常确实来自这次指定地址的探测。</small></span></div></figure>

## 先说清楚谁写 PMP 寄存器

PMP 是 M 模式资源。普通 S 模式内核不能随意执行 `csrw pmpcfg0` 或 `csrw pmpaddr*` 来改变自己的访问边界；这正是特权级设计要保护的东西。因此“我没有在自己的 C 文件里搜索到 pmpaddr”并不等于“没有实现隔离”，但也不能反过来说“我写了一个寄存器驱动”。

在这条链路里，应用侧负责声明策略：哪些内存区域属于哪个 domain、哪些 hart 进入哪个 domain、某个设备是否可见。OpenSBI 的 domain/FDT 代码读取这些声明，并在更高特权级完成实际资源配置。可以把它概括成一句话：我写的是策略和验证，固件写的是寄存器。这是模块边界，而不是对能力的回避。

判断这种工作是否扎实，关键不在于源码里有没有一条 `csrw`，而在于能否解释 region 的粒度和对齐约束、权限位如何映射到 load/store/execute，以及声明之后如何证明固件真的按意图解释了它。

## 双 domain 配置需要同时对齐三件事

第一是地址和链接脚本。以 trusted memory 为例，DTS 中的 base、order 必须和 trusted 侧链接脚本的 `ORIGIN`、长度一致。若区域基址没有满足 PMP 粒度要求，或者链接脚本把代码放到了声明之外，结果可能是启动即 fault，而不是一个清晰的“访问被拒绝”。所以内存布局不是单独的 DTS 任务，必须和链接脚本一起审查。

第二是权限语义。普通 domain 对 trusted 区域应当是不可达，trusted domain 才拥有需要的读写执行权限。UART2 这类 MMIO 资源和普通内存区域也不是同一类描述：设备绑定、访问范围和 domain 归属需要一起看。只检查一个权限数字，而不检查区域地址和设备映射，无法证明隔离边界完整。

第三是 hart 归属和引导目标。`possible-harts` 决定哪些 hart 属于 domain，`boot-hart`、`next-addr` 和 `next-mode` 决定固件将某个 hart 带到哪里。可信 hart 进入 FreeRTOS S 模式时，还涉及上游 M 模式 port 与当前启动约定之间的适配。域的权限、hart 的归属和下一跳地址必须互相一致，否则可能出现“区域权限正确，但错误的 hart 进入了错误的系统”的问题。

## 为什么声明之后还要做异常探针

最容易被误判的是“访问产生了异常，所以 PMP 一定生效”。不一定。访问可能因为页表缺失、地址未映射、设备错误或其他原因失败。为了把原因收窄，探针目标需要先具备合法的页表映射，再故意指向对方 domain 的受保护区域。这样访问失败时，才更有理由把结果归因于 PMP 权限，而不是缺页。

探针至少要同时检查 `scause` 和 `stval`。`scause` 用来确认是预期的 load、store 或 instruction access fault；`stval` 用来确认 fault 地址就是这次探测的目标。如果只检查 `scause`，任意一个访问异常都可能被误报为“隔离通过”。如果访问没有产生预期异常，测试必须主动失败或 panic，不能继续运行到一个绿色终态，否则隔离失效会被静默吞掉。

验证还要覆盖两个方向：普通域访问 trusted 内存和 UART2，trusted 域反向访问普通域资源。六个方向的标记全部命中，才能说明测试覆盖了 load、store、execute 的组合，而不是只验证了一个最容易通过的读操作。探针不替代固件日志，但它把“运行中的访问”纳入了证据链。

## 为什么还要看 OpenSBI 自己的启动打印

探针只说明某次访问被拒绝，不能完整说明 region 是按哪一套权限配置的。验收脚本还会检查 OpenSBI 启动时打印的 domain region 和权限，把它与 DTS 声明对账。固件输出提供了配置解释后的视角，探针提供了实际访问的视角，两者一致时，证据比单看任一方更强。

这也是为什么 QEMU 日志和 trusted 串口日志要分开保留。不同 domain 的标记不能混成一条无法归属的输出流；否则即使看到“六个 PASS”，也不容易回答每个 PASS 是谁发出的、对应哪个访问方向。日志本身不是隔离机制，但它是审计机制的一部分。

## 这套方法的边界

这套方法证明的是指定 QEMU 配置、OpenSBI 构建和内核探针下的访问边界。它不证明任意硬件实现都具有同样的内存保护行为，也不覆盖 DMA 绕过、缓存侧信道、启动链签名或物理攻击。PMP 访问探针是必要的运行证据，不是完整的硬件安全认证。

因此，回答“PMP 是不是你实现的”时，我会把范围说完整：我实现了 domain DTS 的资源策略、启动链适配和双向访问异常探针；OpenSBI 负责根据策略完成固件侧 PMP 配置；QEMU 冒烟验收同时检查固件 region 打印和六类访问异常。这个回答既没有把上游固件功劳据为己有，也没有把一份 DTS 文件夸成已经完成的安全证明。
