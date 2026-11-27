#!/usr/bin/env bash
# Fail when a newly added migration's version is not strictly greater than the
# highest migration version on the base branch (usually main).
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
    # Also catch unstaged / untracked local migration files (handy for local runs).
    git ls-files --others --exclude-standard -- supabase/migrations
    git diff --diff-filter=A --name-only -- supabase/migrations
  } | sed '/^$/d' | sort -u
)

if [[ "$added" -eq 0 ]]; then
  echo "No new migration files vs ${BASE_REF}; version order check skipped."
  exit 0
fi

if [[ "$failed" -gt 0 ]]; then
  echo "${failed} migration(s) are not strictly newer than ${BASE_REF} (max ${max_base_version})." >&2
  exit 1
fi

echo "All ${added} new migration(s) are newer than ${BASE_REF} (max ${max_base_version})."
