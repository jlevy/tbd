# Feature: Pnpm Monorepo Patterns Bi-Directional Sync

**Date:** 2026-02-18 (last updated 2026-02-18)

**Author:** Joshua Levy with LLM assistance

**Status:** Draft

## Overview

Bi-directional sync between the `pnpm-monorepo-patterns.md` guideline and the tbd
codebase. The guideline is a living reference document, and this codebase is a primary
reference implementation.
Both sides have drifted:

- The codebase has fallen behind on several dependency versions and a few recommended
  practices.
- The guideline doesn’t yet document several valuable patterns the codebase has
  pioneered.

This spec covers updating both directions to bring them into full alignment.

## Goals

- Upgrade codebase dependencies and CI config to match current guideline recommendations
- Add missing recommended practices to the codebase (node-free guard test,
  `.flowmarkignore`)
- Update the guideline to document codebase innovations (CJS bootstrap, dependency
  bundling, multi-config tsdown, cross-platform CI)
- Ensure the version table in the guideline reflects current reality
- Keep the codebase’s `engines.node >= 20` policy intentional and documented (not
  accidentally stale)

## Non-Goals

- Changing the codebase’s Node.js minimum from 20 to 24 (that’s a separate decision)
- Migrating to Changesets GitHub Action for releases (tag-triggered OIDC is working
  well)
- Adding ESM/CJS dual format (ESM-only is the correct choice for this CLI tool)

## Background

A thorough audit comparing every section of `pnpm-monorepo-patterns.md` against the
actual codebase configuration revealed:

- **15 areas already aligned** (exports, Prettier, ESLint, git versioning, etc.)
- **9 areas where codebase should update** (CI actions, lefthook v2, Vitest v4, etc.)
- **10 areas where guideline should learn from codebase** (CJS bootstrap, bundling,
  etc.)

## Design

### Approach

Work in two phases: codebase updates first (since they’re more mechanical and testable),
then guideline updates (which require careful writing).

### Risk Assessment

- Dependency upgrades (lefthook v1→v2, Vitest v2→v4, ncu v17→v19) may have breaking
  changes requiring config adjustments
- CI action version bumps (v4→v6) should be straightforward but need testing
- Guideline updates are low-risk (documentation only)

## Implementation Plan

### Phase 1: Codebase Updates (dependency upgrades + CI + practices)

#### 1a. CI Workflow Modernization

- [ ] Update `.github/workflows/ci.yml` to use `actions/checkout@v6`,
  `actions/setup-node@v6`
- [ ] Update CI Node.js version from 22 to 24
- [ ] Verify CI passes on all three platforms (ubuntu, macos, windows)

#### 1b. Dependency Version Upgrades

- [ ] Upgrade `lefthook` from `^1.13.6` to `^2.0.15` in root `package.json`
  - Check for any `lefthook.yml` config format changes between v1 and v2
  - Run `npx lefthook install` after upgrade
- [ ] Upgrade `npm-check-updates` from `^17.1.18` to `^19.0.0` in root `package.json`
- [ ] Upgrade `vitest` from `^2.1.9` to `^4.0.0` in `packages/tbd/package.json`
  - Upgrade `@vitest/coverage-v8` from `^2.1.9` to `^4.0.0`
  - Check for any API changes in Vitest 3→4 (test isolation changes, config format)
  - Run full test suite to verify
- [ ] Upgrade `@types/node` from `^22.19.7` to `^24.0.0` in `packages/tbd/package.json`
  - This aligns with local Node 24 and the release workflow
  - Verify no type errors from the upgrade
- [ ] Run `pnpm install` and verify lockfile updates cleanly
- [ ] Run `pnpm test` to confirm everything passes

#### 1c. Missing Practices

- [ ] Add `node-free-core.test.ts` guard test in `packages/tbd/tests/`
  - Verify `src/index.ts` re-exports only node-free modules
  - Verify `dist/index.mjs` built output has no `node:` references
- [ ] Create `.flowmarkignore` with appropriate exclusions (`.tbd/`, `node_modules/`,
  `attic/`, `template/`, `dist/`)

### Phase 2: Guideline Updates (document codebase innovations)

#### 2a. New Patterns to Document

- [ ] **CJS Bootstrap / Compile Cache Pattern** — Add to Section 13 or 15
  - Document why CJS must run before ESM for `module.enableCompileCache()`
  - Show the `bin-bootstrap.cjs` → `bin.mjs` pattern
  - Note Node 22.8.0+ requirement (graceful degradation on older)

- [ ] **Dependency Bundling for CLI Startup** — Add to Section 13
  - Document `noExternal` in tsdown for bundling deps into CLI binary
  - Explain trade-offs: faster startup vs.
    larger binary, no deduplication
  - Show the `inlineOnly: false` acknowledgment pattern

- [ ] **Multi-Config tsdown (Array Pattern)** — Add to Section 3 / Appendix D
  - Document `defineConfig([...])` with separate configs for library, CLI binary, and
    CJS bootstrap
  - Show how `commonOptions` pattern avoids duplication

- [ ] **Cross-Platform CI Matrix** — Update Section 9
  - Add matrix strategy example for ubuntu/macos/windows
  - Document separate coverage/lint job pattern
  - Mention benchmark job as optional

- [ ] **Conditional Build Script** — Add to Section 13
  - Document the `build:check` / `build-if-needed.mjs` pattern for pre-push hooks
  - Explain why this avoids unnecessary rebuilds

#### 2b. Version Table & Minor Corrections

- [ ] Update guideline version table:
  - pnpm: 10.28.0 → 10.28.2
  - Note that `@changesets/cli/changelog` is a valid alternative to
    `@changesets/changelog-github`
- [ ] Add note to Changeset config section about `@changesets/cli/changelog` as simpler
  alternative
- [ ] Update Appendix C ESLint example to show atomic file writes restriction as an
  example of project-specific rules
- [ ] Add note about CLI command handler ESLint relaxations

#### 2c. Consistency Refinements

- [ ] Note in Section 2 that ES2023 is appropriate when targeting Node 20, ES2024 for
  Node 22+
- [ ] Clarify in OIDC section that hybrid approach (NPM_TOKEN + provenance) is also
  valid
- [ ] Add `.flowmarkignore` recommendation to the flowmark section

## Testing Strategy

### Phase 1 Validation

- All existing tests pass after dependency upgrades (`pnpm test`)
- CI workflow runs successfully on a test branch (all 3 OS platforms)
- `pnpm build` succeeds with upgraded tsdown/vitest
- `pnpm publint` passes
- New `node-free-core.test.ts` passes
- Pre-commit hooks work with lefthook v2 (`git commit` on a test change)
- Pre-push hooks work (`git push` to test branch)

### Phase 2 Validation

- Guideline document renders correctly in markdown
- All code examples in guideline are syntactically valid
- Version table is internally consistent
- Cross-references between sections are accurate

## Open Questions

- **Node.js minimum version**: Should we bump `engines.node` from `>=20` to `>=22` or
  `>=24`? Node 20 EOL is April 2026, Node 22 is current LTS until October 2027. This
  affects `tsconfig.base.json` target (ES2023 vs ES2024) and `@types/node` version.
  **Current decision**: Keep >=20 for now, address in a separate spec.

- **Vitest 4 migration**: Are there breaking changes in the Vitest 3→4 upgrade that
  affect our test setup (global setup, coverage config)?
  Need to check migration guide.

- **Lefthook v2 config compatibility**: Does our `lefthook.yml` need any changes for v2?
  The v2 changelog should be reviewed for breaking changes.

## References

- [pnpm-monorepo-patterns.md](../../../packages/tbd/docs/guidelines/pnpm-monorepo-patterns.md)
  — The guideline being synced
- [development.md](../../development.md) — Project development guide
- [Vitest 4.0 Migration](https://vitest.dev/blog/vitest-4) — Migration guide
- [Lefthook v2 Changelog](https://github.com/evilmartians/lefthook/releases) — Breaking
  changes
- [actions/checkout v6](https://github.com/actions/checkout/releases) — Release notes
