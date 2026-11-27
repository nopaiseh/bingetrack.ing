#!/usr/bin/env bash
# Fail when:
#   - a newly added migration's version is not strictly greater than the highest
#     migration version on the base branch (usually main), or
#   - any migration that already exists on the base branch is Modified, Deleted,
#     or Renamed (migrations are append-only once merged).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BASE_REF="${BASE_REF:-}"
if [[ -z "$BASE_REF" ]]; then
  if [[ -n "${GITHUB_BASE_REF:-}" ]]; then
    BASE_REF="origin/${GITHUB_BASE_REF}"
  else
    BASE_REF="origin/main"
  fi
fi

if ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  echo "Base ref ${BASE_REF} is missing locally; fetching..." >&2
  fetch_ref="${BASE_REF#origin/}"
  git fetch --no-tags --depth=1 origin "$fetch_ref"
fi

migration_version() {
  local path="$1"
  local base
  base="$(basename "$path")"
  if [[ "$base" =~ ^([0-9]+)_ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
  else
    echo "Cannot parse migration version from: ${path}" >&2
    return 1
  fi
}

# True when path exists as a blob on the base ref (i.e. already merged / immutable).
path_on_base() {
  local path="$1"
  git cat-file -e "${BASE_REF}:${path}" 2>/dev/null
}

immutable_failed=0
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  # name-status: "M\tpath", "D\tpath", or "R100\told\tnew"
  status_field="$(printf '%s\n' "$line" | cut -f1)"
  status="${status_field:0:1}"
  case "$status" in
    M)
      path="$(printf '%s\n' "$line" | cut -f2)"
      if ! path_on_base "$path"; then
        continue
      fi
      echo "Immutable migration modified: ${path}" >&2
      echo "  Migrations already on ${BASE_REF} must not be edited; add a new migration instead." >&2
      immutable_failed=$((immutable_failed + 1))
      ;;
    D)
      path="$(printf '%s\n' "$line" | cut -f2)"
      if ! path_on_base "$path"; then
        continue
      fi
      echo "Immutable migration deleted: ${path}" >&2
      echo "  Migrations already on ${BASE_REF} must not be deleted; add a new migration instead." >&2
      immutable_failed=$((immutable_failed + 1))
      ;;
    R)
      old_path="$(printf '%s\n' "$line" | cut -f2)"
      new_path="$(printf '%s\n' "$line" | cut -f3)"
      if ! path_on_base "$old_path"; then
        continue
      fi
      echo "Immutable migration renamed: ${old_path} -> ${new_path}" >&2
      echo "  Migrations already on ${BASE_REF} must not be renamed; add a new migration instead." >&2
      immutable_failed=$((immutable_failed + 1))
      ;;
  esac
done < <(
  {
    # Committed MDR vs base (three-dot): only paths that existed on the merge-base.
    git diff --diff-filter=MDR --name-status "${BASE_REF}...HEAD" -- supabase/migrations
    # Working tree / staged MDR vs HEAD: still filter with path_on_base so edits to
    # migrations *added on this branch* are allowed until merge.
    git diff --diff-filter=MDR --name-status -- supabase/migrations
    git diff --diff-filter=MDR --name-status --cached -- supabase/migrations
  } | sed '/^$/d' | sort -u
)

if [[ "$immutable_failed" -gt 0 ]]; then
  echo "${immutable_failed} immutable migration path(s) were Modified, Deleted, or Renamed." >&2
  exit 1
fi

max_base_version="0"
while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  version="$(migration_version "$path")"
  if ((10#$version > 10#$max_base_version)); then
    max_base_version="$version"
  fi
done < <(git ls-tree -r --name-only "$BASE_REF" -- supabase/migrations | sort)

added=0
failed=0
while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  added=$((added + 1))
  version="$(migration_version "$path")"
  if ! ((10#$version > 10#$max_base_version)); then
    echo "Migration version too old for ${path}" >&2
    echo "  version: ${version}" >&2
    echo "  max on ${BASE_REF}: ${max_base_version}" >&2
    echo "  New migrations must use a timestamp strictly greater than the newest migration on the base branch." >&2
    failed=$((failed + 1))
  else
    echo "OK ${path} (${version} > ${max_base_version})"
  fi
done < <(
  {
    # Committed additions on this branch vs the base ref.
    git diff --diff-filter=A --name-only "${BASE_REF}...HEAD" -- supabase/migrations
    # Also catch staged / unstaged / untracked local migration files (handy for local runs).
    git ls-files --others --exclude-standard -- supabase/migrations
    git diff --diff-filter=A --name-only -- supabase/migrations
    git diff --diff-filter=A --name-only --cached -- supabase/migrations
  } | sed '/^$/d' | sort -u
)

if [[ "$failed" -gt 0 ]]; then
  echo "${failed} migration(s) are not strictly newer than ${BASE_REF} (max ${max_base_version})." >&2
  exit 1
fi

if [[ "$added" -eq 0 ]]; then
  echo "No new migration files vs ${BASE_REF}; immutable paths unchanged; version order check skipped."
  exit 0
fi

echo "All ${added} new migration(s) are newer than ${BASE_REF} (max ${max_base_version})."
