---
name: bump-chain-sdk
description: Bump an Aptos/Sui/Iota SDK version in this monorepo, regenerate builtin and test types, run tests, and prepare a conventional commit. Use when the user asks to upgrade @aptos-labs/ts-sdk, @mysten/sui, @iota/iota-sdk, or any chain SDK version.
disable-model-invocation: true
---

# Bump Chain SDK

Upgrade an Aptos / Sui / Iota SDK version inside this typemove monorepo and propagate the changes through codegen + tests + commit.

## When to use

User says something like:
- "Bump Iota SDK to 1.10.0"
- "Upgrade Sui SDK to the latest"
- "Update @aptos-labs/ts-sdk to 6.1.0"

## Inputs to confirm

Before doing anything, confirm with the user:
- **Chain**: `aptos`, `sui`, or `iota`
- **Target version**: e.g. `1.10.0`, or `latest` if they want you to pick

## Steps

1. **Locate the target package.json**
   - `packages/aptos/package.json` → `@aptos-labs/ts-sdk`
   - `packages/sui/package.json` → `@mysten/sui`
   - `packages/iota/package.json` → `@iota/iota-sdk`
   - Some upgrades also touch the root `package.json` (see commit `472da443` for the Iota 1.10.0 precedent — root `package.json` and `pnpm-lock.yaml` were updated alongside the chain package).

2. **Update the version** in package.json and run `pnpm install` from the repo root to refresh `pnpm-lock.yaml`.

3. **Regenerate builtin types** for the affected chain. Run from the chain package directory:
   ```bash
   cd packages/<chain> && pnpm gen
   ```
   This regenerates `src/builtin/0x1.ts`, `0x2.ts`, `0x3.ts` (Sui/Iota) or `0x1.ts`, `0x3.ts`, `0x4.ts` (Aptos).

4. **Regenerate test types**:
   ```bash
   cd packages/<chain> && pnpm gen:test
   ```

5. **Build the package** to surface any breakage from SDK API changes:
   ```bash
   pnpm --filter @typemove/<chain> build
   ```
   If TypeScript errors appear, they are almost always SDK breaking changes — fix them in `move-coder.ts`, `to-internal.ts`, `chain-adapter.ts`, or the codegen output. Don't hand-edit `src/builtin/` files — fix the codegen source instead.

6. **Run tests for the chain**:
   ```bash
   pnpm --filter @typemove/<chain> test
   ```

7. **Check sibling chains for shared breakage**. SDK upgrades sometimes change shared @typemove/move interfaces. If you touched anything outside `packages/<chain>/`, run `pnpm test:all` and `pnpm build:all`.

8. **Stage and commit** using the canonical message format from history:
   ```
   chore: upgrade <Chain> SDK to <version>
   ```
   Examples from `git log`: `chore: upgrade Iota SDK to 1.10.0`, `chore: upgrade Sui SDK to 2.4.0`.
   Note: these specific upgrade commits use a bare `chore:` prefix without a scope, even though `CLAUDE.md` recommends `chore(deps):` generally. Follow the existing pattern for chain-SDK bumps.

9. **Create the PR** per CLAUDE.md: this repo is PR-only, never push to main. Use `git dev <name>/bump-<chain>-<version>` (custom shortcut from `.github/.gitconfig`) or `git checkout -b dev/<name>/bump-<chain>-<version>`, then `gh pr create`.

## Things to watch for

- **GitHub Actions workflows** sometimes need a matching version bump (e.g. `472da443` touched all four `.github/workflows/*.yaml` files). Grep `.github/workflows/` for the old version string before committing.
- **iota `sync-from-sui` script**: Iota's codegen historically mirrors Sui's. If you bump Sui you may also want to run `pnpm --filter @typemove/iota sync-from-sui` and re-test Iota.
- **Don't manually edit `packages/*/src/builtin/0x*.ts`** — they are codegen outputs and a PreToolUse hook will block edits.
