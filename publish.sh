#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
POST_DIR="$SCRIPT_DIR/source/_posts"

usage() {
  cat <<'EOF'
用法：
  ./publish.sh <Markdown 文件> [文章网址名]

示例：
  ./publish.sh ~/notes/linux-driver.md
  ./publish.sh ~/notes/中文笔记.md linux-driver-notes

如果 Markdown 没有 Hexo 头信息，脚本会自动补充标题、日期和“笔记”分类。
如果 Markdown 旁边有同名资源目录，脚本也会复制其中的图片：
  linux-driver.md
  linux-driver/image.png
EOF
}

die() {
  printf '错误：%s\n' "$*" >&2
  exit 1
}

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
  exit 1
fi

command -v node >/dev/null 2>&1 || die "没有找到 Node.js"
command -v npm >/dev/null 2>&1 || die "没有找到 npm"
command -v git >/dev/null 2>&1 || die "没有找到 Git"

INPUT_PATH="$(realpath -- "$1")"
[[ -f "$INPUT_PATH" ]] || die "文件不存在：$1"

INPUT_NAME="$(basename -- "$INPUT_PATH")"
case "$INPUT_NAME" in
  *.md) BASE_NAME="${INPUT_NAME%.md}" ;;
  *.markdown) BASE_NAME="${INPUT_NAME%.markdown}" ;;
  *) die "只支持 .md 或 .markdown 文件" ;;
esac

SLUG="${2:-$BASE_NAME}"
SLUG="${SLUG// /-}"
[[ -n "$SLUG" ]] || die "文章网址名不能为空"
[[ "$SLUG" != */* ]] || die "文章网址名不能包含斜杠"

mkdir -p "$POST_DIR"
DESTINATION="$POST_DIR/$SLUG.md"
TITLE="${BASE_NAME//-/ }"
TITLE="${TITLE//_/ }"
TITLE_ESCAPED="${TITLE//\"/\\\"}"

TEMP_FILE="$(mktemp)"
trap 'rm -f -- "$TEMP_FILE"' EXIT

FIRST_LINE="$(sed -n '1p' "$INPUT_PATH" | tr -d '\r')"
if [[ "$FIRST_LINE" == '---' ]]; then
  cp -- "$INPUT_PATH" "$TEMP_FILE"
else
  {
    printf '%s\n' '---'
    printf 'title: "%s"\n' "$TITLE_ESCAPED"
    printf 'date: %s\n' "$(TZ=Asia/Shanghai date '+%Y-%m-%d %H:%M:%S')"
    printf '%s\n' 'categories:' '  - 笔记' 'tags: []' '---' ''
    cat -- "$INPUT_PATH"
  } >"$TEMP_FILE"
fi

cp -- "$TEMP_FILE" "$DESTINATION"

ASSET_SOURCE="$(dirname -- "$INPUT_PATH")/$BASE_NAME"
if [[ -d "$ASSET_SOURCE" ]]; then
  ASSET_DESTINATION="$POST_DIR/$SLUG"
  mkdir -p "$ASSET_DESTINATION"
  cp -a -- "$ASSET_SOURCE/." "$ASSET_DESTINATION/"
  printf '已复制文章资源：%s\n' "$ASSET_SOURCE"
fi

cd "$SCRIPT_DIR"

if [[ ! -d node_modules ]]; then
  printf '首次运行，正在安装依赖……\n'
  npm ci
fi

printf '正在检查并生成网站……\n'
npx hexo clean
npx hexo generate

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git add --all
  if ! git diff --cached --quiet; then
    git commit -m "Add post: $TITLE"
  fi
  printf '正在备份 Hexo 源码到 source 分支……\n'
  git push --set-upstream origin source
fi

printf '正在发布到 GitHub Pages……\n'
npx hexo deploy

printf '\n发布完成：https://quchaosheng.github.io/\n'
