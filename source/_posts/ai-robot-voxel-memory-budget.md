---
title: 三维场景记忆的显存预算：体素地图为什么越跑越大
date: 2026-08-11 09:30:00
allow_future: true
permalink: /2026/08/11/ai-robot-voxel-memory-budget/
categories: [技术, AI机器人]
tags: [nvblox, 体素地图, 显存, Isaac ROS]
---

机器人刚启动时避障正常，跑了十几分钟后 GPU 内存不断上涨，最后要么丢帧，要么地图更新直接停住。另一个看似相反的现象是，内存没有上涨，旧障碍却一直留在地图里。两种问题都和“三维记忆”有关，但一个是空间没有回收，一个是清除策略没有生效。

体素地图不是一张静态图片。相机每次观测都会更新一批体素块，位姿、分辨率、最大观测距离、动态障碍物清除和 ESDF 计算都会影响存储量。把地图当成无限大的缓存，最终一定会遇到显存或尾延迟问题。

<div class="note-flow"><span>固定体素尺寸和观测范围</span><i>→</i><span>记录活跃体素块与显存</span><i>→</i><span>验证障碍物清除规则</span><i>→</i><span>限制地图窗口和更新频率</span><i>→</i><span>在长时间运行中复测</span></div>

<figure class="note-visual"><figcaption><span>地图记忆图</span>三维地图的成本由空间范围、体素分辨率、缓存生命周期和派生距离场共同决定。</figcaption><div class="note-map"><span><b>体素尺寸</b><small>体素越小，几何细节越多，单位空间需要的块也越多。</small></span><span><b>活跃块</b><small>相机观测范围和机器人走过的区域决定哪些块被分配。</small></span><span><b>观测射线</b><small>射线终点和自由空间更新会影响障碍物是否被清除。</small></span><span><b>动态障碍</b><small>人和货物离开后需要明确的衰减、清除或重新观测规则。</small></span><span><b>ESDF</b><small>距离场是地图的派生数据，会额外消耗显存和更新时间。</small></span><span><b>地图窗口</b><small>局部窗口和最大距离限制可以把成本变成可估计的上限。</small></span></div></figure>

## 先确认到底是哪块内存涨了

看到 GPU OOM 时，不要只记一条“显存不足”。应该同时记录 TensorRT、体素地图、CUDA stream、相机缓冲和系统共享内存。地图不断变大，和某个节点每帧泄漏，排查路径完全不同。

可以先留下运行时状态：

```bash
tegrastats
ros2 topic hz /camera/depth/image_rect_raw
ros2 topic hz /camera/color/image_raw
ros2 topic echo --once /tf
ros2 node info /nvblox_node
```

命令中的话题名要按实际配置替换。`tegrastats` 看到的是整机资源，不能直接告诉你某个体素层占了多少；还需要结合节点参数、profile 或运行时日志记录活跃块数量、更新频率和清除次数。

如果地图显存和推理显存互相争抢，先用[CUDA 内存与 Stream 的对照实验](/2026/06/22/cuda-memory-stream-basics/)拆出分配、复制、kernel 和同步，再判断是地图生命周期失控，还是每帧缓冲没有复用。

## 体素尺寸和范围先决定一个数量级

如果把一个边长为 `L` 的立方空间按边长 `r` 的体素离散，理论体素数量近似为：

```text
N_voxels ≈ (L / r)^3
```

真实实现通常按块分配，并且只为观测到的区域分配内存，所以这个公式不能当作精确显存结果。它却能提醒你，体素边长从 5 cm 改成 2.5 cm，空间数量级可能增加八倍，而不是“细节增加一倍”。

对移动机器人来说，远处区域通常不需要和近距离抓取区使用同样分辨率。可以采用局部窗口、最大观测距离或分层地图，把计算预算留给规划真正会用到的空间。参数改动后要同时观察地图更新 P99 和规划器拿到的地图年龄。

## 旧障碍为什么不会自己消失

深度相机看见一个箱子时，障碍体素会被标记。箱子被搬走以后，地图只有在后续观测射线经过原位置、清除策略允许更新、并且时间戳和位姿都有效时，才有机会把它改成自由空间。没有新观测时，系统无法凭空证明那里已经空了。

清除逻辑至少要回答三个问题：空闲观测保存多久，动态障碍是否允许衰减，地图暂停更新时导航是否继续使用旧数据。对于安全相关的障碍，宁可让规划器知道“地图过期”并降速，也不要把旧地图当成当前事实。

## ESDF 更新和感知更新不是一回事

体素占据更新成功，不代表 ESDF 已经使用了最新数据。距离场通常有自己的更新周期、工作区和队列。若规划器消费时间为 `t_plan`，地图最新观测时间为 `t_map`，还应记录：

```text
map_age = t_plan - t_map
esdf_age = t_plan - t_esdf_update
```

当 `map_age` 很小而 `esdf_age` 很大时，继续提高相机帧率没有意义，瓶颈在距离场更新或 GPU 资源竞争。控制接口应能收到地图年龄和有效标志，超过截止期就降低速度或暂停规划。

`map_age` 与感知结果年龄可以共用一套记录口径，具体字段见[视觉伺服的端到端延迟预算](/2026/08/04/ai-robot-visual-servo-latency-budget/)。两者都要从源数据时间算到实际消费时刻，不能用节点发布频率代替。

## 长时间运行要做三组测试

第一组让机器人原地观察，确认静态场景下显存和活跃块数量是否稳定。第二组让机器人在有限区域来回走，观察地图窗口是否回收，动态物体离开后多久消失。第三组加入录包、推理和导航负载，测温度变化、显存峰值、地图更新 P99 和规划等待。

| 测试 | 主要观察 | 不能直接推出的结论 |
| --- | --- | --- |
| 原地静态 | 基线显存、更新周期 | 不能证明长距离行走不会增长 |
| 有限区域移动 | 活跃块回收、动态清除 | 不能证明未知环境覆盖充分 |
| 全链路负载 | 资源争抢、P99、地图年龄 | 不能把仿真结果当成真机结果 |

每次测试都保存体素参数、相机分辨率、位姿来源、GPU 型号和功耗模式。只记“跑了半小时没崩”无法复现问题。

## 参考资料

- [Isaac ROS nvblox](https://nvidia-isaac-ros.github.io/repositories_and_packages/isaac_ros_nvblox/index.html)
- [NVIDIA Isaac documentation](https://docs.nvidia.com/isaac/)
- [ROS 2 QoS settings](https://docs.ros.org/en/jazzy/Concepts/Intermediate/About-Quality-of-Service-Settings.html)
- [NVIDIA Jetson documentation](https://docs.nvidia.com/jetson/)

**证据边界：**体素数量公式只是数量级估算，不能替代 nvblox、驱动和目标 GPU 的实际 profile。本文没有给出某个体素尺寸、地图范围或 Jetson 型号的显存上限。发布前应补上运行参数、长时间日志和地图年龄记录。
