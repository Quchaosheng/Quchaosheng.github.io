# Quchaosheng's Notes

这是 `https://quchaosheng.github.io/` 的 Hexo 源码。

- `source` 分支保存 Hexo 源码、Markdown 和发布脚本。
- `master` 分支保存 Hexo 生成的网站，由脚本自动更新。

## 一键发布

把 Markdown 文件交给脚本即可：

```bash
cd /home/sheng/work/quchaosheng-blog
./publish.sh /完整路径/文章.md
```

需要固定简短的网址时，增加第二个参数：

```bash
./publish.sh /完整路径/中文文章.md linux-kernel-notes
```

脚本会自动执行以下操作：

1. 将文章复制到 `source/_posts/`。
2. 为没有头信息的 Markdown 自动增加标题、日期和分类。
3. 检查并生成静态网站。
4. 将源码备份到 GitHub 的 `source` 分支。
5. 将生成的网站发布到 `master` 分支。

## Markdown 头信息

建议在文章开头添加：

```yaml
---
title: Linux 驱动学习笔记
date: 2026-07-14 10:00:00
categories:
  - Linux
tags:
  - Kernel
  - Driver
---
```

没有这段内容也可以，发布脚本会自动补充基本信息。

## 内容分类

网站目前分为两个顶层栏目：`技术` 和 `感悟`。

技术笔记：

```yaml
---
title: Linux 驱动学习笔记
date: 2026-07-19 10:00:00
categories:
  - 技术
tags:
  - Linux
  - Kernel
---
```

读书感悟：

```yaml
---
title: 《书名》阅读感悟
date: 2026-07-19 10:00:00
categories:
  - 感悟
  - 读书
tags:
  - 阅读
---
```

播客感悟：

```yaml
---
title: 一期播客带来的思考
date: 2026-07-19 10:00:00
categories:
  - 感悟
  - 播客
tags:
  - 播客
---
```

没有 front matter 的 Markdown 会默认进入 `技术`；读书和播客文章请显式填写上面的分类。

## 图片

Markdown 和图片目录使用相同名称：

```text
linux-driver.md
linux-driver/
  architecture.png
```

Markdown 中直接写：

```markdown
![架构图](architecture.png)
```

执行 `./publish.sh linux-driver.md` 时，图片目录会一起复制和发布。

## 本地预览

```bash
npm install
npx hexo clean
npx hexo server
```

浏览器访问 `http://localhost:4000/`。

## 换电脑恢复

```bash
git clone -b source git@github.com:Quchaosheng/Quchaosheng.github.io.git quchaosheng-blog
cd quchaosheng-blog
npm install
```

## Windows 发布笔记

推荐使用 Git Bash。第一次准备：

```bash
git clone -b source https://github.com/Quchaosheng/Quchaosheng.github.io.git quchaosheng-blog
cd quchaosheng-blog
npm install
```

以后每篇笔记只需要执行：

```bash
./publish.sh "D:/notes/linux-driver.md"
```

需要固定网址名时，增加第二个参数：

```bash
./publish.sh "D:/notes/linux-driver.md" linux-driver
```

脚本会自动完成以下操作：

1. 将 Markdown 复制到 `source/_posts/`。
2. 没有 Hexo 头信息时，自动补充标题、日期和分类。
3. 同名资源目录一起复制，例如 `linux-driver/image.png`。
4. 生成网站并推送 `source` 分支。
5. 发布生成的网站到 `master` 分支。

发布后访问：<https://quchaosheng.github.io/>。

## 桌面同步

桌面上的 `Quchaosheng-Notes` 文件夹可以作为笔记投递箱：

```text
Quchaosheng-Notes/
├─ 技术/
├─ 感悟/读书/
└─ 感悟/播客/
```

把 `.md` 放入对应目录后，双击文件夹里的 `同步到博客.cmd`。脚本会根据目录自动传入分类，并调用现有发布流程；Markdown 旁边的同名图片目录也会一起同步。

