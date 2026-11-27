#!/usr/bin/env bash
# Vercel Ignored Build Step（vercel.json → ignoreCommand）
#
# 退出码约定（Vercel 官方）：
#   exit 0 → 跳过本次构建
#   exit 1 → 继续构建
#
# 规则（已批准）：
#   1. 生产（VERCEL_ENV=production，即 main）永远构建
#   2. 预览默认跳过；仅当提交标题（首行）含 [preview]，或相对 main 的改动含前端界面文件时才构建
#   3. dependabot/、renovate/ 分支一律跳过，除非提交标题含 [preview]
#   4. 判断不了（浅克隆、fetch 失败、无 merge-base）时保守构建，并打印原因
#
# 前端界面路径（本仓库）：
#   - components/**、hooks/**、public/**
#   - 样式配置：uno.config.ts、postcss.config.*、tailwind.config.*
#   - app/ 下的页面／布局／组件（*.tsx／*.jsx）、样式（*.css 等）、静态资源
#   - 不算前端：app/api/**、**/route.ts、**/actions.ts、**/*-actions.ts、
#     lib/**、supabase/**、docs／*.md、tests／e2e、.github、依赖 lockfile
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

log() {
  printf '%s\n' "$*"
}

build() {
  log "→ 将执行构建（exit 1）：$*"
  exit 1
}

skip() {
  log "→ 跳过构建（exit 0）：$*"
  exit 0
}

VERCEL_ENV="${VERCEL_ENV:-}"
COMMIT_REF="${VERCEL_GIT_COMMIT_REF:-}"
COMMIT_MSG="${VERCEL_GIT_COMMIT_MESSAGE:-}"
PREVIOUS_SHA="${VERCEL_GIT_PREVIOUS_SHA:-}"

# 只看提交标题（首行）。正文或标题里“描述”该标记的句子若写出字面量也会触发，故说明性提交标题勿写入该字面量。
COMMIT_SUBJECT="${COMMIT_MSG%%$'\n'*}"

log "vercel-ignore-build：VERCEL_ENV=${VERCEL_ENV:-<unset>} REF=${COMMIT_REF:-<unset>}"
log "提交标题：${COMMIT_SUBJECT:-<empty>}"

# --- 1. 生产永远构建 ---
if [[ "$VERCEL_ENV" == "production" ]]; then
  build "生产环境（VERCEL_ENV=production）"
fi

# --- 提交标题是否要求强制预览 ---
has_preview_tag=0
if [[ "$COMMIT_SUBJECT" == *"[preview]"* ]]; then
  has_preview_tag=1
  log "检测到提交标题含 [preview]"
fi

if [[ "$has_preview_tag" -eq 1 ]]; then
  build "作者／审查人通过 [preview] 要求构建预览"
fi

# --- 3. 依赖升级机器人：默认跳过（[preview] 已在上面处理）---
case "$COMMIT_REF" in
  dependabot/* | renovate/*)
    skip "依赖升级分支（${COMMIT_REF}），且提交标题无 [preview]"
    ;;
esac

# --- 前端路径判断 ---
# 返回 0 = 是前端界面相关文件
is_frontend_ui_path() {
  local path="${1#./}"

  case "$path" in
    components/* | hooks/* | public/*)
      return 0
      ;;
    uno.config.ts | postcss.config.mjs | postcss.config.js | postcss.config.cjs | \
    tailwind.config.ts | tailwind.config.js | tailwind.config.mjs | tailwind.config.cjs)
      return 0
      ;;
    *.css | *.scss | *.sass | *.less)
      return 0
      ;;
    app/api/*)
      return 1
      ;;
    app/*)
      local base
      base="$(basename "$path")"
      case "$base" in
        route.ts | route.js | route.mjs | route.tsx | route.jsx)
          return 1
          ;;
        actions.ts | actions.js | actions.mjs)
          return 1
          ;;
        *-actions.ts | *-actions.js | *-actions.mjs)
          return 1
          ;;
      esac
      case "$path" in
        *.tsx | *.jsx | *.css | *.scss | *.sass | *.less | \
        *.ico | *.png | *.svg | *.jpg | *.jpeg | *.webp | *.gif | \
        *.woff | *.woff2)
          return 0
          ;;
      esac
      return 1
      ;;
  esac
  return 1
}

# --- 确保能看到 origin/main（Vercel 默认浅克隆）---
ensure_main_available() {
  if git rev-parse --verify origin/main >/dev/null 2>&1; then
    log "已有本地 origin/main"
    return 0
  fi

  log "本地缺少 origin/main，尝试 git fetch（浅克隆加深）…"
  if git fetch --no-tags --depth=50 origin main 2>&1; then
    if git rev-parse --verify origin/main >/dev/null 2>&1; then
      log "fetch origin main 成功"
      return 0
    fi
  else
    log "git fetch origin main 失败（可能无凭据／网络限制）"
  fi
  return 1
}

# 在浅历史上寻找与 main 的 merge-base；必要时加深历史
find_merge_base() {
  local base=""
  local attempt
  for attempt in 1 2 3; do
    if base="$(git merge-base HEAD origin/main 2>/dev/null)"; then
      printf '%s\n' "$base"
      return 0
    fi
    log "merge-base 失败（第 ${attempt} 次），加深历史再试…"
    # 同时加深当前 HEAD 与 main，避免只有一侧有足够祖先
    git fetch --no-tags --deepen=100 origin main 2>&1 || true
    git fetch --no-tags --deepen=100 origin HEAD 2>&1 || \
      git fetch --no-tags --deepen=100 2>&1 || true
  done
  return 1
}

list_changed_files() {
  local range="$1"
  git diff --name-only "$range"
}

CHANGED_FILES=""
DIFF_SOURCE=""

if ensure_main_available; then
  if MERGE_BASE="$(find_merge_base)"; then
    log "merge-base with origin/main: ${MERGE_BASE}"
    CHANGED_FILES="$(list_changed_files "${MERGE_BASE}...HEAD" || true)"
    DIFF_SOURCE="merge-base(${MERGE_BASE})...HEAD"
  else
    log "无法计算与 origin/main 的 merge-base（浅历史仍不足）"
  fi
fi

# 退路：相对上一部署提交的 diff（仅覆盖最近一次推送，不完整但优于瞎猜）
if [[ -z "$DIFF_SOURCE" && -n "$PREVIOUS_SHA" ]]; then
  if git cat-file -e "${PREVIOUS_SHA}^{commit}" 2>/dev/null; then
    log "退回使用 VERCEL_GIT_PREVIOUS_SHA=${PREVIOUS_SHA}"
    CHANGED_FILES="$(list_changed_files "${PREVIOUS_SHA}...HEAD" || true)"
    DIFF_SOURCE="previous-sha(${PREVIOUS_SHA})...HEAD"
  else
    log "VERCEL_GIT_PREVIOUS_SHA=${PREVIOUS_SHA} 在本地不可用"
  fi
fi

if [[ -z "$DIFF_SOURCE" ]]; then
  build "无法取得相对 main（或 previous SHA）的改动列表，保守构建"
fi

log "改动来源：${DIFF_SOURCE}"
if [[ -z "${CHANGED_FILES//[$'\t\r\n']/}" ]]; then
  skip "相对比较范围内无文件改动"
fi

log "改动文件："
frontend_hits=()
while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  if is_frontend_ui_path "$path"; then
    log "  [前端] $path"
    frontend_hits+=("$path")
  else
    log "  [非前端] $path"
  fi
done <<<"$CHANGED_FILES"

if [[ "${#frontend_hits[@]}" -gt 0 ]]; then
  build "检测到 ${#frontend_hits[@]} 个前端界面相关改动"
fi

skip "预览部署且无前端界面改动、提交标题无 [preview]"
