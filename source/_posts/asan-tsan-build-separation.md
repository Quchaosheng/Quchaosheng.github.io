---
title: ASan 与 TSan：内存错误和数据竞争为什么不能在同一份构建里检查
date: 2026-09-13 09:30:00
permalink: /2026/09/13/asan-tsan-build-separation/
categories: [技术, 调试]
tags: [Sanitizer, ASan, TSan, 并发, 内存错误]
---

程序在测试里偶发崩溃，或者多线程下的结果不稳定。这时候用 sanitizer 构建来复现是很自然的想法。但把 AddressSanitizer 和 ThreadSanitizer 一起打开会直接构建失败，即使勉强打开，得到的报告也常常互相干扰。

原因不是工具实现不完善，而是两者对内存的假设根本冲突。理解这一点，才能决定在哪个阶段用哪个工具。

<div class="note-flow"><span>确定要查的问题类型</span><i>→</i><span>选择对应 sanitizer</span><i>→</i><span>单独构建一份二进制</span><i>→</i><span>用固定输入复现</span><i>→</i><span>读取报告并定位</span><i>→</i><span>修复后重新验证</span></div>

<figure class="note-visual"><figcaption><span>工具与问题对应</span>地址、线程与未定义行为是三类不同问题，需要各自的检测手段。</figcaption><div class="note-map"><span><b>ASan</b><small>检查越界、释放后使用和重复释放等地址问题。</small></span><span><b>TSan</b><small>记录线程访问历史，报告缺少同步的数据竞争。</small></span><span><b>UBSan</b><small>检查溢出、类型违例等未定义行为，可与 ASan 同时使用。</small></span><span><b>影子内存</b><small>ASan 用影子内存记录可访问性，与 TSan 的实现互相冲突。</small></span><span><b>开销</b><small>两者都会显著降低性能，通常不用于正式发布构建。</small></span><span><b>复现输入</b><small>能稳定复现的输入是报告可解释的前提。</small></span></div></figure>

## 两个工具的假设互斥

ASan 通过影子内存标记每一段地址是否可访问，在每次内存访问上插入检查。它需要精确控制地址空间布局和分配行为。

TSan 的做法是记录每个内存位置的访问历史与同步顺序，用它判断两个线程的访问之间是否存在边。它也需要对内存布局和运行时行为有很强的假设。

两者都要接管内存分配、拦截运行时库、并在编译期插入检查代码。这些接管方式互相冲突，因此不能在同一份二进制里共存。构建系统会直接拒绝这种组合，这不是可以绕过的限制。

## 按问题类型选择工具

选工具的第一步是明确要查什么。

偶发崩溃、栈被破坏、疑似释放后使用、内存越界，这些指向地址问题，应该用 ASan。多线程结果不稳定、加锁顺序相关、数据被并发读写，这些指向竞争问题，应该用 TSan。

在实践中，顺序通常是先用 ASan 把内存问题清理掉，再用 TSan 查竞争。因为内存越界会破坏 TSan 自己维护的元数据，让竞争报告充满噪声。反过来先修竞争再修内存问题，收益也不高。

构建方式是在编译和链接阶段都加上对应选项：

```bash
cmake -DCMAKE_BUILD_TYPE=Debug \
  -DCMAKE_CXX_FLAGS="-fsanitize=address -fno-omit-frame-pointer -g" \
  -DCMAKE_EXE_LINKER_FLAGS="-fsanitize=address" ..
```

`-g` 与不省略帧指针这两项很关键。没有它们，报告里的调用栈会退化成地址，定位代价远高于构建代价。

## 报告要按证据顺序读

一次崩溃报告通常包含错误类型、访问地址、以及分配和释放的调用栈。阅读顺序建议是先看错误类型，再看访问地址属于哪一类区域，最后看栈。

几个常见误读。第一，报告里第一次出现的栈不一定是出错位置，可能是分配位置。第二，`new`/`delete` 的栈只说明这块内存曾经属于谁，不说明当前访问者是谁。第三，多线程程序里，报告中的线程编号需要和业务线程对应起来才有意义。

需要稳定的复现输入。如果同一份输入下报告时有时无，可能是竞争而非越界，这时候换用 TSan 更合适，而不是继续调整 ASan 的采样。

## 用未定义行为检查补充

UBSan 检查的是另一类问题，并且可以和 ASan 同时使用。它捕捉的是有符号溢出、错位访问、类型违例这类标准未定义的操作。这些问题可能多年不触发，换个编译器或优化等级就变成真实故障。

```bash
cmake -DCMAKE_CXX_FLAGS="-fsanitize=address,undefined -fno-omit-frame-pointer -g" ..
```

在 CI 里跑 sanitizer 构建时，需要注意它只在被测代码真正执行到相关路径时才报告。没有覆盖到的分支不会得到保护，因此 sanitizer 的结果应该和测试覆盖率一起看，而不是当作完整证明。

## 与发布构建的边界

sanitizer 构建改变了内存布局、分配策略和运行时行为。它能发现的问题是真实存在的，但不能据此推断发布构建下的性能特征，也不能保证发布构建中不存在同类问题——只是那些路径在测试里没有被执行到。

因此这类构建适合放在持续集成和专项排查里，不适合直接作为交付产物。

## 参考资料

- [AddressSanitizer 文档](https://clang.llvm.org/docs/AddressSanitizer.html)
- [ThreadSanitizer 文档](https://clang.llvm.org/docs/ThreadSanitizer.html)
- [UndefinedBehaviorSanitizer 文档](https://clang.llvm.org/docs/UndefinedBehaviorSanitizer.html)

## 证据边界

本文讨论 sanitizer 的适用场景与构建方式，不包含任何具体项目的检测结果。工具报告只能说明被执行的路径上存在或未发现某类问题；未覆盖的分支、外部依赖内部以及硬件相关行为，都需要各自的检测手段与证据。
