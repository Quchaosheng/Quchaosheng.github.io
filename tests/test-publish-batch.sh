#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

PROJECT="$TEST_ROOT/project"
BIN="$TEST_ROOT/bin"
INBOX="$TEST_ROOT/inbox"
CALL_LOG="$TEST_ROOT/calls.log"
GIT_CALL_LOG="$TEST_ROOT/git-calls.log"
mkdir -p "$PROJECT/source/_posts" "$BIN" "$INBOX"
cp -- "$SCRIPT_DIR/publish.sh" "$PROJECT/publish.sh"

cat >"$BIN/node" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

cat >"$BIN/npm" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

cat >"$BIN/npx" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$CALL_LOG"
exit 0
EOF

cat >"$BIN/git" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$GIT_CALL_LOG"
case "${1:-}" in
  rev-parse) printf 'true\n' ;;
  diff) exit 1 ;;
esac
exit 0
EOF

chmod +x "$BIN/node" "$BIN/npm" "$BIN/npx" "$BIN/git"
printf 'first note\n' >"$INBOX/first.md"
printf 'second note\n' >"$INBOX/second.md"

export CALL_LOG
export GIT_CALL_LOG
PATH="$BIN:$PATH" bash "$PROJECT/publish.sh" --batch \
  "$INBOX/first.md" first '技术' \
  "$INBOX/second.md" second '感悟|读书'

test -f "$PROJECT/source/_posts/first.md"
test -f "$PROJECT/source/_posts/second.md"
grep -Fqx '  - 技术' "$PROJECT/source/_posts/first.md"
grep -Fqx '  - 感悟' "$PROJECT/source/_posts/second.md"
grep -Fqx '  - 读书' "$PROJECT/source/_posts/second.md"
test "$(grep -c '^hexo clean$' "$CALL_LOG")" -eq 1
test "$(grep -c '^hexo generate$' "$CALL_LOG")" -eq 1
test "$(grep -c '^hexo deploy$' "$CALL_LOG")" -eq 1

grep -Fqx 'add -- source/_posts/first.md source/_posts/second.md' "$GIT_CALL_LOG"
grep -Fqx 'commit -m Add 2 notes -- source/_posts/first.md source/_posts/second.md' "$GIT_CALL_LOG"
if grep -Fq -- '--all' "$GIT_CALL_LOG"; then
  echo 'publish must not stage the entire worktree' >&2
  exit 1
fi

: >"$CALL_LOG"
: >"$GIT_CALL_LOG"
PATH="$BIN:$PATH" bash "$PROJECT/publish.sh" "$INBOX/first.md" single 技术
test -f "$PROJECT/source/_posts/single.md"
test "$(grep -c '^hexo clean$' "$CALL_LOG")" -eq 1
test "$(grep -c '^hexo generate$' "$CALL_LOG")" -eq 1
test "$(grep -c '^hexo deploy$' "$CALL_LOG")" -eq 1
grep -Fqx 'add -- source/_posts/single.md' "$GIT_CALL_LOG"

if PATH="$BIN:$PATH" bash "$PROJECT/publish.sh" --batch \
  "$INBOX/first.md" same '技术' \
  "$INBOX/second.md" same '感悟|读书' 2>"$TEST_ROOT/duplicate.log"; then
  echo 'duplicate slugs should fail' >&2
  exit 1
fi
grep -Fq '重复' "$TEST_ROOT/duplicate.log"

printf 'batch publish tests passed\n'
