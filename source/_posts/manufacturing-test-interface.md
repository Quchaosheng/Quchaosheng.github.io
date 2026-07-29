---
title: 产测接口：让每块板子都能快速证明自己正常
date: 2026-07-29 14:45:00
categories: [技术, 嵌入式]
tags: [产测, 自检, 可追溯性]
---

产测固件应提供可自动化命令，依次检测电源、时钟、存储、通信和关键外设，并输出机器可解析结果、序列号与校准数据。

<div class="note-flow"><span>扫描设备身份</span><i>→</i><span>执行分项自检</span><i>→</i><span>采集测量与错误码</span><i>→</i><span>写入序列号/校准值</span><i>→</i><span>上传结果并锁定量产配置</span></div>

产测命令与售后诊断可复用底层能力，但量产后危险操作必须鉴权或关闭。参考：[letter-shell](https://github.com/NevermindZZT/letter-shell)
