---
title: VFS 路径查找：目录字符串如何定位 inode
date: 2026-04-10 10:00:00
permalink: /2026/07/29/vfs-path-lookup/
categories: [技术, 文件系统]
tags: [VFS, dentry, inode]
---

路径查找从根目录或当前目录开始逐段解析组件，优先查询 dentry cache，未命中时调用具体文件系统查找 inode，并处理挂载点、符号链接和权限。像 `/a/b/c` 这样简单的字符串，在内核里不是一次哈希查找，而是一连串带边界条件的目录遍历。

<div class="note-flow"><span>选择起始目录</span><i>→</i><span>逐段解析路径</span><i>→</i><span>查询 dcache</span><i>→</i><span>必要时读取文件系统元数据</span><i>→</i><span>得到最终 path/inode</span></div>

<figure class="note-visual"><figcaption><span>路径图</span>一个路径组件会经过 dentry、inode、挂载和权限等多层检查。</figcaption><div class="note-map"><span><b>起始 path</b><small>绝对路径从根开始，相对路径从 cwd 或 `dirfd` 开始。</small></span><span><b>dentry cache</b><small>缓存“名称到 inode”的关联，也可缓存不存在的负结果。</small></span><span><b>inode</b><small>提供对象元数据和具体文件系统的 lookup 操作。</small></span><span><b>挂载点</b><small>解析途中可能切换到另一个挂载的根目录。</small></span><span><b>符号链接</b><small>会引入新的路径解析，次数和边界都需要限制。</small></span><span><b>权限检查</b><small>目录搜索权限和最终对象权限都可能让查找失败。</small></span></div></figure>

## 快路径依赖缓存，慢路径才会访问文件系统

常见路径的组件往往已在 dcache 中，内核可快速完成查找；缓存未命中、目录发生变化或遇到需要引用计数保护的情况时，会走更重的路径并调用文件系统操作。负 dentry 缓存“不存在”也很重要，否则频繁探测缺失文件会反复触发底层查找。

遇到路径性能问题时，要区分是大量组件解析、符号链接、挂载穿越、权限检查，还是缓存频繁失效。盲目增加缓存或把路径拼得更短，都不一定解决真正的 I/O 或锁竞争。

## 路径约束是服务安全边界

当服务代表用户访问文件时，`../` 过滤远远不够，符号链接和目录替换仍可能越出预期目录。`openat2` 提供解析约束，能限制链接、挂载穿越等行为；无论使用何种接口，都应从受控目录 fd 出发，并明确哪些路径操作被允许。

参考：[Linux 路径名查找过程](https://www.kerneltravel.net/blog/2020/checkpath_cpc/)
