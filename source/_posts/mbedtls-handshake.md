---
title: mbedTLS：嵌入式 TLS 握手与证书校验
date: 2026-05-26 14:00:00
permalink: /2026/07/29/mbedtls-handshake/
categories: [技术, 嵌入式网络]
tags: [mbedTLS, TLS, 证书]
---

TLS 握手协商版本与密码套件，验证服务器证书并完成密钥交换，随后用会话密钥保护应用数据。对嵌入式设备来说，最容易被忽略的不是加密 API，而是可信根证书、主机名、可靠时间、随机数源和长期证书轮换。把证书验证关掉能让连接“成功”，也会让 TLS 失去身份验证意义。

<div class="note-flow"><span>TCP 连接</span><i>→</i><span>ClientHello/ServerHello</span><i>→</i><span>证书链与主机名校验</span><i>→</i><span>密钥派生与 Finished</span><i>→</i><span>加密传输与会话恢复</span></div>

<figure class="note-visual"><figcaption><span>信任图</span>链路加密、服务器身份和设备自身密钥保护是不同的检查项。</figcaption><div class="note-map"><span><b>ClientHello</b><small>声明支持的 TLS 版本、算法和随机数，不能随意降级。</small></span><span><b>证书链</b><small>从服务器证书向上验证到设备内置或安全更新的可信根。</small></span><span><b>主机名</b><small>证书有效还不够，名称也必须与目标服务匹配。</small></span><span><b>时间来源</b><small>证书有效期依赖可信时间，首次联网和 RTC 异常都要处理。</small></span><span><b>随机数</b><small>密钥材料依赖高质量熵源，不能只用可预测的计数器。</small></span><span><b>会话恢复</b><small>减少握手成本，但票据和恢复状态仍需受保护和过期管理。</small></span></div></figure>

## 证书错误要按原因处理

链不受信、主机名不匹配、证书过期、时间错误和网络中间人并不是同一个故障。日志应保留验证失败的具体类别和服务端名称，而不是只报“TLS handshake failed”。设备首次没有可信时间时，要设计受控的时间引导和校时流程，不能永久跳过有效期检查。

## 资源约束下也不能省掉边界

缓冲区大小、握手峰值内存、密码套件和会话恢复会影响 RAM 与延迟，但优化不能以关闭验证为代价。私钥、设备证书和可信根的存放、更新和撤销策略也要在产品设计阶段确定。网络断开或握手失败时应使用退避重试，避免大量设备同时反复消耗 CPU 和无线带宽。

参考：[mbedTLS](https://github.com/Mbed-TLS/mbedtls)
