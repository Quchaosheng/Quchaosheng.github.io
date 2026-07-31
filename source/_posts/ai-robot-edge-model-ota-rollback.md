---
title: 边缘模型升级与回滚：签名、兼容性和灰度发布怎样接起来
date: 2026-08-14 09:30:00
allow_future: true
permalink: /2026/08/14/ai-robot-edge-model-ota-rollback/
categories: [技术, AI机器人]
tags: [OTA, 模型升级, Jetson, 回滚]
---

模型更新后，设备能启动，推理进程却在加载 engine 时退出。更麻烦的是，部分设备已经换成新模型，另一部分还在旧版本，现场日志看起来像两个不同的产品。模型文件未必损坏，发布单元却散了：模型、TensorRT、GPU 架构、预处理和配置各走各的版本。

机器人上的模型升级要有回滚路径。签名只能证明文件来自某个发布者，不能证明它适合这台设备；兼容性检查只能筛掉明显不匹配，不能替代小流量运行和任务指标验收。发布系统需要把身份、版本、健康检查和回滚状态连起来。

<div class="note-flow"><span>生成带清单的模型包</span><i>→</i><span>验证签名和设备兼容性</span><i>→</i><span>写入备用分区</span><i>→</i><span>小流量启动并观察健康指标</span><i>→</i><span>确认或自动回滚</span></div>

<figure class="note-visual"><figcaption><span>升级状态图</span>新模型先处于候选状态，只有通过加载、推理和任务健康检查后才成为当前版本。</figcaption><div class="note-map"><span><b>模型包</b><small>包含权重、engine、预处理、标签、配置和构建环境指纹。</small></span><span><b>签名</b><small>验证包的来源和完整性，防止传输或存储中的文件被替换。</small></span><span><b>兼容性</b><small>检查 GPU、TensorRT、输入 shape、插件和模型 schema。</small></span><span><b>候选槽位</b><small>把新版本写入不影响当前运行的 A/B 槽位或备用目录。</small></span><span><b>健康检查</b><small>确认进程存活、输入输出有效、延迟和错误率在预算内。</small></span><span><b>确认/回滚</b><small>设备重启或健康检查失败时回到上一个可启动版本。</small></span></div></figure>

## 一个模型包应该带什么

只上传 `model.engine` 不够。至少要把模型版本、权重摘要、TensorRT/CUDA 版本、GPU 计算能力、输入 shape、颜色顺序、归一化参数、输出 schema 和校准集摘要放进 manifest。预处理脚本或配置少一个，现场就可能出现“模型加载成功但结果全错”。

清单可以长这样。JSON 比注释丰富的 YAML 更笨一些，但设备端可以直接用 Python 标准库读取，适合做最小验证器：

```json
{
  "model_id": "pick-detector",
  "model_version": "2026.08.14-rc1",
  "files": {"model.engine": "<sha256>"},
  "runtime": {"tensorrt_major": 10, "cuda_major": 12},
  "input": {"shape": [1, 3, 480, 640], "color": "BGR", "scale": 0.0039215686},
  "output_schema": "detections.v3"
}
```

字段是示意，版本号要以实际环境为准。生成包后先在构建机和一台目标设备上验证摘要：

```bash
sha256sum model.engine manifest.json
openssl dgst -sha256 -verify release.pub -signature manifest.sig manifest.json
```

签名命令只覆盖签名的文件。工程上应明确哪些文件被签名，以及 manifest 是否包含其他文件的摘要。

设备端还要把包清单与本机能力比较。下面的验证器检查文件摘要、TensorRT/CUDA 主版本和输出 schema。保存为 `validate_package.py`，再给它一个由设备镜像生成的 `device-profile.json`。

```python
import hashlib
import json
import pathlib
import sys


package_dir = pathlib.Path(sys.argv[1])
profile_path = pathlib.Path(sys.argv[2])
manifest = json.loads((package_dir / "manifest.json").read_text())
profile = json.loads(profile_path.read_text())
errors = []

for relative_path, expected in manifest["files"].items():
    payload = (package_dir / relative_path).read_bytes()
    actual = hashlib.sha256(payload).hexdigest()
    if actual != expected:
        errors.append(f"sha256 mismatch: {relative_path}")

for field in ("tensorrt_major", "cuda_major"):
    required = manifest["runtime"][field]
    installed = profile["runtime"][field]
    if required != installed:
        errors.append(f"{field}: package={required}, device={installed}")

if manifest["output_schema"] not in profile["accepted_output_schemas"]:
    errors.append(f"unsupported schema: {manifest['output_schema']}")

if errors:
    raise SystemExit("REJECT\n" + "\n".join(errors))
print(f"ACCEPT {manifest['model_id']} {manifest['model_version']}")
```

```bash
openssl dgst -sha256 -verify release.pub -signature package/manifest.sig package/manifest.json
python3 validate_package.py package device-profile.json
```

这个验证器故意不尝试加载 engine。文件和静态字段通过后，还要在隔离进程里反序列化 engine、执行金丝雀输入，再由发布状态机决定能否切换活动槽位。

## 兼容性检查要早于启动服务

TensorRT engine 往往和 GPU 架构、TensorRT 版本、插件及构建选项有关。设备收到新包后，应先读取 manifest，与本机 runtime、GPU、输入 shape 和插件列表比对。缺少插件、版本不在允许范围或 schema 不兼容时，直接拒绝激活并保留旧版本。

不要把“进程没有崩”当作健康。启动后还要送入固定的金丝雀输入，检查输出是否包含有限值、类别映射是否一致、处理时间是否在预算内。金丝雀输入只能证明链路可跑，不能替代真实任务数据。

## A/B 槽位解决的是启动回滚

A/B 可以是两个分区、两个容器标签或两个模型目录，具体形式取决于设备系统。核心顺序是：旧版本继续提供服务，新版本写入备用位置，完成校验后才改变活动指针；重启后如果新版本没有在确认期限内报告健康，启动管理器回到旧版本。

```text
current=A
install candidate=B
verify B -> boot B -> health window
health ok  -> confirm B, retire A later
health bad -> select A, record rollback reason
```

健康窗口里要检查进程、推理错误、输入年龄、任务拒绝率和资源峰值。只检查 HTTP 200 或进程 PID，无法发现模型输出已经偏移。

## 灰度发布要按设备和任务分层

先选一小组设备，固定任务和环境，观察一段完整工作周期。比较新旧版本的结果年龄、P99、显存、检测错误和人工接管次数。若只是平均 FPS 提高，任务错误却增加，不能继续扩大范围。设备侧要能报告当前模型版本和回滚计数，后台才能知道“升级成功”究竟指什么。

回滚也要演练：下载中断、签名失败、磁盘已满、engine 加载失败、健康窗口超时、设备断电和网络断开。回滚状态应该落盘，重启后不能因为状态丢失再次尝试坏版本。

## 把故障动作写成表，不靠临场判断

| 故障点 | 激活新版本前的动作 | 当前服务 | 需要记录 |
| --- | --- | --- | --- |
| 下载中断 | 删除或保留带状态的临时文件 | 继续旧版本 | 已收字节、重试原因 |
| 签名失败 | 拒绝包并停止重试 | 继续旧版本 | 包 ID、签名摘要、来源 |
| 磁盘不足 | 不解包，不改活动指针 | 继续旧版本 | 可用空间、包大小 |
| engine 无法加载 | 标记候选槽位失败 | 继续或回到旧版本 | runtime、GPU、插件错误 |
| 金丝雀输出异常 | 拒绝确认 | 回到旧版本 | 输入摘要、输出、阈值 |
| 健康窗口超时 | 触发自动回滚 | 回到旧版本 | 启动次数、最后心跳 |
| 切换时掉电 | 读取持久化事务状态 | 选择最近已确认版本 | 槽位状态、启动计数 |

模型包上线前的数值检查可接着看[TensorRT FP16/INT8 精度回归](/2026/08/10/ai-robot-tensorrt-precision-regression/)，上线后的任务级判据则应进入[AI 机器人验收报告](/2026/08/25/ai-robot-acceptance-evidence/)。两个环节分别回答“模型数值有没有漂”和“机器人任务有没有退化”。

## 参考资料

- [NVIDIA TensorRT documentation](https://docs.nvidia.com/deeplearning/tensorrt/latest/)
- [NVIDIA Jetson documentation](https://docs.nvidia.com/jetson/)
- [systemd.service(5)](https://man7.org/linux/man-pages/man5/systemd.service.5.html)
- [ROS 2 lifecycle nodes](https://design.ros2.org/articles/node_lifecycle.html)

**证据边界：**本文描述模型发布和回滚的系统设计，没有声称某种 A/B 实现、签名算法或 Jetson 版本已经满足特定安全标准。模型兼容性、健康阈值和掉电恢复必须在目标设备上实测。
