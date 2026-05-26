#!/usr/bin/env bash
# PreToolUse hook: refuse edits to packages/<chain>/src/builtin/0x*.ts
# These files are codegen outputs. Hand-edits get wiped on the next `pnpm gen`.
# Fix the codegen source or ABIs instead, then re-run codegen via the regen-builtins skill.

set -euo pipefail

input="$(cat)"
file_path="$(printf '%s' "$input" | /usr/bin/env jq -r '.tool_input.file_path // empty')"

if [ -z "$file_path" ]; then
  exit 0
fi

case "$file_path" in
  */packages/aptos/src/builtin/0x*.ts \
  | */packages/sui/src/builtin/0x*.ts \
  | */packages/iota/src/builtin/0x*.ts)
    cat >&2 <<EOF
Refusing to edit $file_path: this is a codegen output.

Hand-edits will be overwritten the next time \`pnpm gen\` runs in the chain package.
Fix the codegen logic (packages/<chain>/src/codegen/) or the ABI (packages/<chain>/src/abis/),
then regenerate via the \`regen-builtins\` skill or \`cd packages/<chain> && pnpm gen\`.
EOF
    exit 2
    ;;
esac

exit 0
