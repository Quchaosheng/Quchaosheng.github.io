---
title: mbedTLS：嵌入式 TLS 握手与证书校验
date: 2026-07-17 14:10:00
permalink: /2026/07/29/mbedtls-handshake/
categories: [技术, 嵌入式网络]
tags: [mbedTLS, TLS, 证书]
---

TLS 握手协商版本与密码套件，验证服务器证书并完成密钥交换，随后用会话密钥保护应用数据。设备必须拥有可信根证书和可靠时间来源。

<div class="note-flow"><span>TCP 连接</span><i>→</i><span>ClientHello/ServerHello</span><i>→</i><span>证书链与主机名校验</span><i>→</i><span>密钥派生与 Finished</span><i>→</i><span>加密传输与会话恢复</span></div>

不要关闭证书验证来“解决连接问题”；还要规划证书轮换、随机数源和私钥保护。参考：[mbedTLS](https://github.com/Mbed-TLS/mbedtls)
