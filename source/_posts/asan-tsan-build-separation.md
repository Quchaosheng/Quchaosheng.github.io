---
title: ASan 与 TSan：内存错误和数据竞争为什么不能在同一份构建里检查
date: 2026-09-13 09:30:00
permalink: /2026/09/13/asan-tsan-build-separation/
categories: [技术, 调试]
tags: [Sanitizer, ASan, TSan, 并发, 内存错误]
---

想在一个构建里同时抓内存错误和数据竞争，第一次试的人基本都会撞上编译失败。我当时以为是参数写法不对，翻了半天文档才发现这不是配置问题。

ASan 和 TSan 对内存的假设是互斥的。理解这一点之后，选工具这件事就变得很直接了。

<div class="note-flow"><span>定问题类型</span><i>→</i><span>选对应 sanitizer</span><i>→</i><span>单独构建一份二进制</span><i>→</i><span>用固定输入复现</span><i>→</i><span>读报告定位</span><i>→</i><span>修完重新验证</span></div>

<figure class="note-visual"><figcaption><span>工具与问题对应</span>地址、线程和未定义行为是三类问题，各有各的检测手段。</figcaption><div class="note-map"><span><b>ASan</b><small>越界、释放后使用、重复释放这类地址问题。</small></span><span><b>TSan</b><small>记录线程访问历史，报告缺同步的数据竞争。</small></span><span><b>UBSan</b><small>溢出、类型违例等未定义行为，能和 ASan 一起用。</small></span><span><b>影子内存</b><small>ASan 用它记可访问性，实现上和 TSan 冲突。</small></span><span><b>开销</b><small>两者都明显变慢，不适合当发布构建。</small></span><span><b>复现输入</b><small>能稳定复现，报告才可解释。</small></span></div></figure>

## 为什么不能一起开

ASan 用影子内存标记每段地址是否可访问，并在每次内存访问上插检查，需要精确控制地址空间布局和分配行为。

TSan 记的是每个内存位置的访问历史和同步顺序，用来判断两次线程访问之间是否存在边。它同样需要强假设。

两者都要接管内存分配、拦截运行时库、在编译期插桩。这些接管方式互相冲突，构建系统直接拒绝这种组合，绕不过去。

## 按问题选工具

先想清楚要查什么。

偶发崩溃、栈被破坏、疑似释放后使用、内存越界，指向地址问题，用 ASan。多线程结果不稳定、跟加锁顺序相关、数据被并发读写，指向竞争，用 TSan。

顺序上我习惯先用 ASan 清理内存问题，再上 TSan。因为越界会破坏 TSan 自己维护的元数据，让竞争报告充满噪声。反过来先修竞争再修内存问题，收益不高。

编译和链接阶段都要加对应选项：

```bash
cmake -DCMAKE_BUILD_TYPE=Debug \
  -DCMAKE_CXX_FLAGS="-fsanitize=address -fno-omit-frame-pointer -g" \
  -DCMAKE_EXE_LINKER_FLAGS="-fsanitize=address" ..
```

`-g` 和不省略帧指针这两项别省。没有它们，报告里的栈会退化成地址，定位成本远高于构建成本。

## 报告怎么读

一份崩溃报告通常有错误类型、访问地址、分配和释放的调用栈。我的顺序是先看错误类型，再看地址属于哪类区域，最后看栈。

几个容易读错的地方。报告里第一次出现的栈不一定是出错位置，可能是分配位置。`new`/`delete` 的栈只说明这块内存曾经属于谁，不说明现在谁在访问它。多线程程序里，报告中的线程编号得和业务线程对上才有意义。

复现输入要稳定。同一份输入下报告时有时无，那多半是竞争而不是越界，这时候换 TSan 更合适，而不是继续调 ASan 的参数。

## 顺带用 UBSan

UBSan 查的是另一类问题，而且能和 ASan 同时开。它抓的是有符号溢出、错位访问、类型违例这些标准未定义的操作。这类问题可能多年不发作，换个编译器或者开个优化就变成真故障。

```bash
cmake -DCMAKE_CXX_FLAGS="-fsanitize=address,undefined -fno-omit-frame-pointer -g" ..
```

CI 里跑 sanitizer 要注意，它只在代码真的执行到相关路径时才报。没覆盖到的分支不受保护，所以这个结果应该和覆盖率一起看，别当成完整证明。

## 和发布构建的边界

sanitizer 构建会改变内存布局、分配策略和运行时行为。它发现的问题是真实存在的，但不能拿来推断发布构建的性能特征，也不能保证发布构建里没有同类问题——只是那些路径在测试里没被执行到。

所以这类构建适合放在持续集成和专项排查里，不适合直接当交付产物。

## 参考资料

- [AddressSanitizer 文档](https://clang.llvm.org/docs/AddressSanitizer.html)
- [ThreadSanitizer 文档](https://clang.llvm.org/docs/ThreadSanitizer.html)
- [UndefinedBehaviorSanitizer 文档](https://clang.llvm.org/docs/UndefinedBehaviorSanitizer.html)

**证据边界：**本文不包含具体项目的检测结果。工具报告只能说明被执行到的路径上存在或未发现某类问题；没覆盖的分支、外部依赖内部以及硬件相关的行为，都需要各自的检测手段。
