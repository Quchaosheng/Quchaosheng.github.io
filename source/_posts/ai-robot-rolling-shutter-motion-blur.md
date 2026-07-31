---
title: Rolling Shutter、曝光与运动模糊：为什么移动机器人会错一拍
date: 2026-08-05 09:30:00
allow_future: true
permalink: /2026/08/05/ai-robot-rolling-shutter-motion-blur/
categories: [技术, AI机器人]
tags: [相机, Rolling Shutter, 标定, 视觉伺服]
---

相机固定在桌上时，AprilTag 和目标框都很稳。把相机装到底盘上，转一个弯，画面里的标记开始倾斜，深度点云也跟着抖。模型没有换，参数也没有改，变化来自相机本身：Rolling Shutter 逐行读图，图像顶部和底部并不属于同一时刻；曝光时间太长时，单行内部又会积累一段运动轨迹。

我会先把这两个误差分开。行读出造成时间错位，曝光造成运动模糊。它们都能让位姿抖动，但修法不一样。

<div class="note-flow"><span>确认快门和时间戳含义</span><i>→</i><span>记录曝光、分辨率和帧率</span><i>→</i><span>固定相机做静态基线</span><i>→</i><span>加入已知速度的运动</span><i>→</i><span>把误差接入拒绝条件</span></div>

<figure class="note-visual"><figcaption><span>时空图</span>一帧 Rolling Shutter 图像更像一段时间内的采样，不应被当作单一时刻。</figcaption><div class="note-map"><span><b>行读出</b><small>首行和末行的采样时刻不同，时间戳要说明它对应哪一个事件。</small></span><span><b>曝光窗口</b><small>曝光期间目标移动越多，边缘越软，细小标记越容易丢。</small></span><span><b>运动速度</b><small>底盘速度、机械臂角速度和目标距离共同决定像素位移。</small></span><span><b>内参</b><small>焦距、主点和畸变误差会把几何偏差继续放大。</small></span><span><b>外参与 TF</b><small>相机外参和 TF 查询时间必须与图像采样时间相容。</small></span><span><b>控制策略</b><small>结果太旧或图像太糊时，应降速、重采样或拒绝本次控制。</small></span></div></figure>

## 一张图不一定只有一个时间点

全局快门可以近似看作整帧同时采样。Rolling Shutter 更接近下面这个排查模型：第 `r` 行在帧起点之后 `r * t_row` 附近被读出。

```text
t_row_sample(r) = t_frame_start + r * row_readout_time
```

`row_readout_time` 取决于传感器模式、分辨率和驱动配置。这个公式不是统一 API 的承诺。相机或 SDK 如果提供了曝光开始、曝光中点和传输完成等多个时间，应记录它们各自的含义，不要只在配置文件里写一个“帧时间戳”。

机器人向前走时，底部像素对应的机器人位置通常比顶部更靠前。平面目标会出现倾斜或拉伸，AprilTag 的四个角不再属于同一个姿态。机械臂抓取时，末端和目标都可能在动，时间错位还会进入 TF 和控制器，最后表现成“跟踪算法偶尔发疯”。

## 曝光时间解决的是另一件事

曝光时间决定每一行收集光子的时间窗口。已知目标在图像上的速度，可以先估一个模糊量级：

```text
blur_pixels ≈ image_velocity_pixels_per_second * exposure_seconds
```

真实结果还受镜头畸变、自动曝光、增益和图像锐化影响。缩短曝光会减少拖影，却可能让噪声上升，自动增益随后把噪声放大。调参时要同时记录亮度、增益和识别结果，不能只截一张看起来更清楚的图。

## 先做一个不带控制器的基线

我会把相机和目标固定住，先确认内参、畸变和深度噪声。接着让目标做已知速度的平移，估计曝光造成的模糊；再把相机装回机器人，低速移动，检查外参和时间戳；最后才把速度提高并接入控制闭环。每一步只改变一个变量，抓取任务不要作为第一项测试，因为它同时混入了规划、夹爪和控制误差。

Linux 相机可以先留下 V4L2 的能力信息：

```bash
v4l2-ctl --all
v4l2-ctl --list-formats-ext
v4l2-ctl --get-fmt-video
v4l2-ctl --get-parm
```

ROS 2 侧至少记录图像编码、分辨率、帧率、`header.stamp`、相机信息和 TF：

```bash
ros2 topic hz /camera/image_raw
ros2 topic echo --once /camera/image_raw/header
ros2 topic echo --once /camera/camera_info
ros2 run tf2_ros tf2_monitor base_link camera_link
```

使用 GStreamer、Isaac ROS 或厂商 SDK 时，还要把实际曝光、增益、触发模式和时间戳来源写入实验记录。配置写成 5 ms，不代表传感器在当前分辨率和帧率下真的用到了 5 ms。

TF 查询要使用哪个时间点，可以接着看[TF2 的帧与时间基础](/2026/05/21/ros2-tf2-frame-time-basics/)；相机时间、推理和控制如何放进一张预算表，见[视觉伺服端到端延迟](/2026/08/04/ai-robot-visual-servo-latency-budget/)。这两步能避免把时间错位误诊成模型抖动。

## 什么时候该换全局快门

高速抓取、视觉伺服、AprilTag 对接和多相机三维重建都依赖几何一致性。可以按成本顺序试几步：先降低机器人速度并缩短曝光；再用硬件触发或统一时钟，让相机、IMU 和控制器的关系可验证；如果仍不够，再评估运动补偿、IMU 校正或全局快门。每加一层补偿，都要测它本身的延迟和失效条件。

短曝光修不了行间时间错位，全局快门也修不了错误的 TF 外参和过期队列。换相机之后还要重新做内参、外参和时间同步标定。

## 把坏结果挡在控制器外面

图像曝光异常、模糊估计超过阈值、目标像素面积过小、姿态协方差过大或结果年龄超过截止期，都可以触发降速、重新采样或安全停止。阈值应和任务速度、目标尺寸以及急停策略一起验收。正在运动的机器人拿到一个错误但高置信度的结果，比暂时没有结果更危险。

## 参考资料

- [ROS 2 sensor_msgs/Image](https://docs.ros.org/en/jazzy/p/sensor_msgs/msg/Image.html)
- [ROS 2 CameraInfo](https://docs.ros.org/en/jazzy/p/sensor_msgs/msg/CameraInfo.html)
- [ROS 2 camera_calibration package](https://docs.ros.org/en/jazzy/p/camera_calibration/)
- [ROS 2 Clock and Time Design](https://design.ros2.org/articles/clock_and_time.html)
- [NVIDIA Isaac ROS Image Pipeline](https://nvidia-isaac-ros.github.io/repositories_and_packages/isaac_ros_image_pipeline/index.html)

**证据边界：**行采样模型和模糊公式只是排查用的近似，不能替代目标传感器的数据手册或实测时间戳。本文没有给出某个相机的快门类型、行读出时间或抓取成功率。发布前应补充设备配置、标定参数、运动速度和图像质量记录。
