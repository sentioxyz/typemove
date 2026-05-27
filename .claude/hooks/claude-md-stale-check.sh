#!/usr/bin/env bash
# Stop hook: when this branch changed files that CLAUDE.md documents
# (build/test scripts, workspace config, CI workflows, package layout) but
# CLAUDE.md itself wasn't touched, ask Claude to review and update it before
# finishing. Emits a Stop "block" decision so Claude continues with the
# instruction; guarded by stop_hook_active so it fires at most once per turn
# and never loops.

set -euo pipefail

input="$(cat)"

# Avoid re-triggering: if we're already inside a stop-hook continuation, let
# the stop proceed.
active="$(printf '%s' "$input" | jq -r '.stop_hook_active // false')"
if [ "$active" = "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# Determine the base to diff against (the branch's fork point from main).
base=""
for ref in origin/main main; do
  if git rev-parse --verify --quiet "$ref" >/dev/null 2>&1; then
    base="$(git merge-base HEAD "$ref" 2>/dev/null || true)"
    [ -n "$base" ] && break
  fi
done

# Collect changed files: committed-on-branch + staged + unstaged + untracked.
{
  [ -n "$base" ] && git diff --name-only "$base"...HEAD 2>/dev/null
  git diff --name-only HEAD 2>/dev/null
  git ls-files --others --exclude-standard 2>/dev/null
} | sort -u > /tmp/.cmd-changed-$$ || true

changed="$(cat /tmp/.cmd-changed-$$ 2>/dev/null || true)"
rm -f /tmp/.cmd-changed-$$

[ -z "$changed" ] && exit 0

# If CLAUDE.md was already updated, nothing to nag about.
if printf '%s\n' "$changed" | grep -qiE '(^|/)CLAUDE\.md$'; then
  exit 0
fi

# Structural files whose changes typically need to be reflected in CLAUDE.md:
# root/package manifests (scripts, commands), workspace config, CI workflows,
# and added/removed packages. Generated/lock/output files are ignored.
structural="$(printf '%s\n' "$changed" | grep -E \
  -e '(^|/)package\.json$' \
  -e '(^|/)pnpm-workspace\.yaml$' \
  -e '^\.github/workflows/.*\.ya?ml$' \
  | grep -vE '(^|/)(dist|builtin|abis|types|node_modules)/' || true)"

[ -z "$structural" ] && exit 0

reason="This branch changed files that CLAUDE.md documents but CLAUDE.md was not updated:
$(printf '%s\n' "$structural" | sed 's/^/  - /')

Before finishing, review whether CLAUDE.md (commands, package layout, build/test/workflow docs) needs updating to match these changes. If it does, update it. If the changes don't affect anything CLAUDE.md describes, say so briefly in one line and stop."

jq -n --arg r "$reason" '{decision: "block", reason: $r}'
