---
name: regen-builtins
description: Regenerate the committed builtin/0x* TypeScript bindings for a chain package (aptos, sui, or iota) by running its codegen. Use when ABIs change, after upgrading an SDK, or whenever the builtin/ output is stale relative to src/abis/.
---

# Regenerate Builtins

Run a chain package's codegen to refresh `packages/<chain>/src/builtin/0x*.ts`.

## When to use

- ABIs under `packages/<chain>/src/abis/` changed
- Codegen logic under `packages/<chain>/src/codegen/` or `packages/move/src/codegen/` changed
- After bumping a chain SDK (see also: `bump-chain-sdk` skill)
- The committed `builtin/` files look stale or someone hand-edited them by mistake

## How to run

Each chain package has its own `gen` script that targets the right addresses. Run it from the package directory:

| Chain | Command | Addresses generated |
|-------|---------|--------------------|
| Aptos | `cd packages/aptos && pnpm gen` | `0x1`, `0x3`, `0x4` |
| Sui   | `cd packages/sui && pnpm gen`   | `0x1`, `0x2`, `0x3` |
| Iota  | `cd packages/iota && pnpm gen`  | `0x1`, `0x2`, `0x3` |

Test types live elsewhere and have a separate script:

| Chain | Command | Output |
|-------|---------|--------|
| Aptos | `cd packages/aptos && pnpm gen:test` | `src/tests/types/` |
| Sui   | `cd packages/sui && pnpm gen:test`   | `src/tests/types/testnet/` |
| Iota  | `cd packages/iota && pnpm gen:test`  | `src/tests/types/testnet/` |

## After regenerating

- Run `pnpm --filter @typemove/<chain> build` to confirm the new output compiles.
- Run `pnpm --filter @typemove/<chain> test` to make sure tests still pass against the new types.
- The output is committed — diff it (`git diff packages/<chain>/src/builtin/`) and include it in the same PR as whatever triggered the regeneration.

## Notes

- Do not hand-edit `packages/*/src/builtin/0x*.ts`. They are deterministic codegen outputs and a PreToolUse hook blocks direct edits. Fix the source (ABIs, codegen) and re-run this skill.
- The codegen entrypoint is `tsx src/codegen/run.ts` in each chain package; `pnpm gen` is just the canonical invocation. Refer to the package's `package.json` `scripts._gen` for the exact flags.
