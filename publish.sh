#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
POST_DIR="$SCRIPT_DIR/source/_posts"

usage() {
  cat <<'EOF'
用法：
  ./publish.sh <Markdown 文件> [文章网址名] [分类]
  ./publish.sh --batch <Markdown 文件> <文章网址名> <分类> ...

示例：
  ./publish.sh ~/notes/linux-driver.md
  ./publish.sh ~/notes/中文笔记.md linux-driver-notes 技术
  ./publish.sh ~/notes/book.md book-notes '感悟|读书'
  ./publish.sh --batch ~/notes/a.md a 技术 ~/notes/b.md b '感悟|播客'

如果 Markdown 没有 Hexo 头信息，脚本会自动补充标题、日期、分类和标签。
如果 Markdown 旁边有同名资源目录，脚本也会复制其中的图片：
  linux-driver.md
  linux-driver/image.png

--batch 模式会先准备全部文章，再统一生成、推送和发布一次。
EOF
}

die() {
  printf '错误：%s\n' "$*" >&2
  exit 1
}

if [[ "${1:-}" == '--batch' ]]; then
  BATCH_MODE=true
  shift
  (( $# >= 3 && $# % 3 == 0 )) || {
    usage
    exit 1
  }
else
  BATCH_MODE=false
  [[ $# -ge 1 && $# -le 3 ]] || {
    usage
    exit 1
  }
fi

command -v node >/dev/null 2>&1 || die "没有找到 Node.js"
command -v npm >/dev/null 2>&1 || die "没有找到 npm"
command -v git >/dev/null 2>&1 || die "没有找到 Git"

declare -a INPUT_PATHS=()
declare -a BASE_NAMES=()
declare -a SLUGS=()
declare -a CATEGORY_SPECS=()
declare -a TITLES=()
declare -a GIT_PATHS=()

add_note() {
  local input_arg="$1"
  local slug_override="$2"
  local category_spec="$3"
  local input_path input_name base_name slug

  input_path="$(realpath -- "$input_arg")"
  [[ -f "$input_path" ]] || die "文件不存在：$input_arg"

  input_name="$(basename -- "$input_path")"
  case "$input_name" in
    *.md) base_name="${input_name%.md}" ;;
    *.markdown) base_name="${input_name%.markdown}" ;;
    *) die "只支持 .md 或 .markdown 文件" ;;
  esac

  slug="${slug_override:-$base_name}"
  slug="${slug// /-}"
  [[ -n "$slug" ]] || die "文章网址名不能为空"
  [[ "$slug" != */* ]] || die "文章网址名不能包含斜杠"

  [[ -n "$category_spec" ]] || die "分类不能为空"
  local -a categories=()
  IFS='|' read -r -a categories <<< "$category_spec"
  for category in "${categories[@]}"; do
    [[ -n "$category" ]] || die "分类不能为空"
  done

  local title="${base_name//-/ }"
  title="${title//_/ }"
  INPUT_PATHS+=("$input_path")
  BASE_NAMES+=("$base_name")
  SLUGS+=("$slug")
  CATEGORY_SPECS+=("$category_spec")
  TITLES+=("$title")
}

if [[ "$BATCH_MODE" == true ]]; then
  while (( $# > 0 )); do
    add_note "$1" "$2" "$3"
    shift 3
  done
else
  input_arg="$1"
  input_name="$(basename -- "$input_arg")"
  case "$input_name" in
    *.md) base_name="${input_name%.md}" ;;
    *.markdown) base_name="${input_name%.markdown}" ;;
    *) die "只支持 .md 或 .markdown 文件" ;;
  esac
  add_note "$1" "${2:-$base_name}" "${3:-技术}"
fi

for ((i = 0; i < ${#SLUGS[@]}; i++)); do
  for ((j = i + 1; j < ${#SLUGS[@]}; j++)); do
    if [[ "${SLUGS[i]}" == "${SLUGS[j]}" ]]; then
      die "批量发布中存在重复的文章网址名：${SLUGS[i]}（${INPUT_PATHS[i]} 与 ${INPUT_PATHS[j]}）"
    fi
  done
done

mkdir -p "$POST_DIR"
TEMP_FILE="$(mktemp)"
trap 'rm -f -- "$TEMP_FILE"' EXIT

for ((i = 0; i < ${#INPUT_PATHS[@]}; i++)); do
  input_path="${INPUT_PATHS[i]}"
  base_name="${BASE_NAMES[i]}"
  slug="${SLUGS[i]}"
  category_spec="${CATEGORY_SPECS[i]}"
  title="${TITLES[i]}"
  title_escaped="${title//\"/\\\"}"
  destination="$POST_DIR/$slug.md"

  first_line="$(sed -n '1p' "$input_path" | tr -d '\r')"
  if [[ "$first_line" == '---' ]]; then
    cp -- "$input_path" "$TEMP_FILE"
  else
    {
      printf '%s\n' '---'
      printf 'title: "%s"\n' "$title_escaped"
      printf 'date: %s\n' "$(TZ=Asia/Shanghai date '+%Y-%m-%d %H:%M:%S')"
      printf '%s\n' 'categories:'
      IFS='|' read -r -a categories <<< "$category_spec"
      for category in "${categories[@]}"; do
        printf '  - %s\n' "$category"
      done
      printf '%s\n' 'tags: []' '---' ''
      cat -- "$input_path"
    } >"$TEMP_FILE"
  fi

  cp -- "$TEMP_FILE" "$destination"
  GIT_PATHS+=("source/_posts/$slug.md")

  asset_source="$(dirname -- "$input_path")/$base_name"
  if [[ -d "$asset_source" ]]; then
    asset_destination="$POST_DIR/$slug"
    mkdir -p "$asset_destination"
    cp -a -- "$asset_source/." "$asset_destination/"
    GIT_PATHS+=("source/_posts/$slug")
    printf '已复制文章资源：%s\n' "$asset_source"
  fi

  printf '已准备：%s [%s]\n' "$(basename -- "$input_path")" "$category_spec"
done

cd "$SCRIPT_DIR"

if [[ ! -d node_modules ]]; then
  printf '首次运行，正在安装依赖……\n'
  npm ci
fi

printf '正在检查并生成网站……\n'
npx hexo clean
npx hexo generate

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git add -- "${GIT_PATHS[@]}"
  if ! git diff --cached --quiet -- "${GIT_PATHS[@]}"; then
    if (( ${#TITLES[@]} == 1 )); then
      commit_message="Add post: ${TITLES[0]}"
    else
      commit_message="Add ${#TITLES[@]} notes"
    fi
    git commit -m "$commit_message" -- "${GIT_PATHS[@]}"
  fi
  printf '正在备份 Hexo 源码到 source 分支……\n'
  git push --set-upstream origin source
fi

printf '正在发布到 GitHub Pages……\n'
npx hexo deploy

printf '\n发布完成：https://quchaosheng.github.io/\n'
