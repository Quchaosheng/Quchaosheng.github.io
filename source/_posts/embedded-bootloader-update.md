---
title: 嵌入式 Bootloader：安全升级与失败回滚
date: 2026-05-07 14:00:00
permalink: /2026/07/29/embedded-bootloader-update/
categories: [技术, 嵌入式]
tags: [Bootloader, OTA, 回滚]
---

升级最危险的时刻不是下载完成，而是设备只剩一份可启动程序、此时恰好掉电。可靠的 Bootloader 要始终保留一份已知可用的镜像，并把新固件当作“待试运行”的候选项：只有它通过校验、正常启动并主动确认后，才成为新的默认镜像。

<div class="note-flow"><span>下载到非活动分区</span><i>→</i><span>校验哈希与签名</span><i>→</i><span>标记待试启动</span><i>→</i><span>应用自检并确认</span><i>→</i><span>失败则回滚旧镜像</span></div>

<figure class="note-visual"><figcaption><span>镜像状态</span>把镜像内容和“这次该启动谁”的状态分开保存。</figcaption><div class="note-map"><span><b>活动槽 A</b><small>当前已确认、可作为回滚目标的镜像。</small></span><span><b>候选槽 B</b><small>下载新版本时写入的非活动区域。</small></span><span><b>完整性校验</b><small>先核对长度、哈希和签名，再允许试启动。</small></span><span><b>pending 标记</b><small>告诉 Bootloader 下一次只试运行候选镜像。</small></span><span><b>确认标记</b><small>应用在必要自检完成后显式写入。</small></span><span><b>启动计数</b><small>候选镜像反复失败时停止尝试并回到旧版本。</small></span></div></figure>

## 校验发生在擦写之前，也发生在启动之前

下载端应在传输完成后核对镜像长度和哈希；Bootloader 在跳转前还要验证签名、目标硬件和版本策略。防回滚不能只比较一个可写的版本号，那个版本号本身也要受到完整性保护。生产系统还需要明确公钥放在哪里，以及密钥更新时如何保证旧设备仍能验证新镜像。

## 应用确认不能放在刚启动时

新应用跳转成功并不等于升级成功。它至少要完成自身完整性检查、关键配置读取和必要外设初始化，再调用确认接口。若把确认放在 `main()` 的第一行，后续初始化崩溃、看门狗复位或关键功能不可用时，Bootloader 已经失去回滚依据。

每次状态切换都应能承受掉电：先写新状态和校验，验证可读后再提交。A/B 分区、恢复镜像和外部下载器的具体实现不同，但“永远不要覆盖唯一的好镜像”是相同的底线。

参考：[OpenBLT](https://www.feaser.com/openblt/doku.php)
