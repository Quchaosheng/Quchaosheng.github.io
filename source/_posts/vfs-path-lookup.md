---
title: VFS 路径查找：目录字符串如何定位 inode
date: 2026-05-31 10:00:00
permalink: /2026/07/29/vfs-path-lookup/
categories: [技术, 文件系统]
tags: [VFS, dentry, inode]
---

路径查找从根目录或当前目录开始逐段解析组件，优先查询 dentry cache，未命中时调用具体文件系统查找 inode，并处理挂载点、符号链接和权限。

<div class="note-flow"><span>选择起始目录</span><i>→</i><span>逐段解析路径</span><i>→</i><span>查询 dcache</span><i>→</i><span>必要时读取文件系统元数据</span><i>→</i><span>得到最终 path/inode</span></div>

dentry 表示“名称到 inode”的关联，负 dentry 还能缓存不存在的结果。`openat2` 可通过 resolve 标志限制越界、链接和挂载穿越。

参考：[Linux 路径名查找过程](https://www.kerneltravel.net/blog/2020/checkpath_cpc/)
