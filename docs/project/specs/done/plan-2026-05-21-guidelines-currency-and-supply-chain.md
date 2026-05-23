---
title: Plan Spec — Guidelines Currency Refresh & Supply-Chain Mitigation
description: Refresh time-sensitive Bun/pnpm/TypeScript guidelines and codify a
  supply-chain mitigation policy (14-day package-age rule) across guidelines and
  applied to our own repo.
author: Joshua Levy (github.com/jlevy)
---
# Feature: Guidelines Currency Refresh & Supply-Chain Mitigation Policy

**Date:** 2026-05-21 (last updated 2026-05-21)

**Author:** Joshua Levy

**Status:** Done (completed 2026-05-23; shipped in get-tbd v0.1.28, commit 98be216)

## Overview

Two coupled changes to the `packages/tbd/docs/guidelines/` collection:

1. **Currency refresh.** All time-sensitive guidelines (Bun monorepo, pnpm monorepo,
   TypeScript rules, TypeScript CLI rules, TypeScript code coverage, YAML handling,
   sorting patterns) were last researched 2026-02-18. As of 2026-05-21 the Bun,
   TypeScript, and Node ecosystems have moved materially — Bun 1.3.14 (Rust rewrite
   merged 2026-05-14), TypeScript 6.0 stable (2026-03-23) plus TS 7.0 Beta
   (2026-04-21), Biome 2.4.x, lefthook 2.1.8, etc. Refresh all of them in one pass
   so the "Last Researched Versions" tables and the body text agree.

2. **New supply-chain mitigation policy: the 14-day package-age rule.** Several
   high-profile supply-chain attacks in the npm/Bun ecosystem in 2025–2026
   (including the Shai-Hulud 2.0 campaign of May 2026 that compromised 170+ npm
   packages) have shipped malware through fresh package versions that are caught
   and yanked within days. The mitigation: **never install or upgrade to a
   package version less than 14 days old.** Codify this in both the Bun and pnpm
   monorepo guides, with concrete tooling guidance for enforcement. Apply the
   rule to our own repo as we upgrade — no dependency pin in `tbd` should
   resolve to a version published fewer than 14 days before the upgrade commit.

## Goals

- Every time-sensitive guideline has a correct, May 2026 "Last Researched
  Versions" table backed by verified release pages (no fabricated versions).
- Every code example, GitHub Actions snippet, and appendix in the Bun and pnpm
  monorepo guides reflects current tools and APIs.
- A clear, copy-pasteable **Supply-Chain Mitigation** section appears in both
  the Bun and pnpm monorepo guides with the same normative content (kept in
  sync via an explicit sync note).
- The 14-day rule is enforceable with concrete commands and tooling
  recommendations (e.g., `ncu --cooldown 14`, `pnpm audit`, `bun audit`,
  `npm view <pkg> time.<version>` checks).
- The `tbd` repository's own `package.json` files do not pin any version
  published fewer than 14 days before the upgrade commit. At minimum, a
  documented manual check or a small script enforces this on dependency
  changes.
- Cross-references between guidelines stay consistent; nothing points to a
  stale or moved section.

## Non-Goals

- Rewriting the high-level architecture or opinionated choices in the guides
  (still: Bun + Bunup + Biome + Changesets in one track, pnpm + tsdown +
  Vitest + Prettier + ESLint in the other).
- Adding new guidelines outside the listed set (no separate "security
  guidelines" doc — the Supply-Chain section lives inside the existing
  monorepo guides).
- Migrating `tbd`'s own toolchain between tracks (pnpm → Bun or vice versa).
- Auditing transitive dependencies in `pnpm-lock.yaml` for past violations of
  the 14-day rule. Going forward only.
- Adopting TypeScript 7.0 Beta (`tsgo`) in `tbd` itself — only document its
  status in the guideline.

## Background

The Bun monorepo guide (`bun-monorepo-patterns.md`, ~2832 lines) and pnpm
guide (`pnpm-monorepo-patterns.md`, ~3438 lines) both carry a "Last Updated:
2026-02-18" header and an explicit "Last Researched Versions" table designed
to be re-checked on a cadence. Three months have passed and the following
entries are now demonstrably stale (per background research dispatched
2026-05-21):

- **Bun runtime**: 1.3.14 (was 1.3.8). 1.3.14 is the **last Zig-based release**;
  the Rust rewrite merged 2026-05-14. New built-ins of note: `Bun.Image`
  (Sharp replacement), experimental HTTP/3 in `Bun.serve()`, 7× faster warm
  installs via isolated linker global store.
- **TypeScript**: 6.0 stable (2026-03-23), 7.0 Beta (2026-04-21,
  `@typescript/native-preview`, binary `tsgo`). 6.0 is the last
  JavaScript-based release. Doc currently says 5.9.3 stable.
- **Biome**: 2.4.15 (was 2.3.14). Embedded snippets (CSS/GraphQL in template
  literals), 15 HTML a11y rules, framework-specific rules promoted to stable.
- **Bunup**: 0.16.31 (was 0.16.22). Bug fixes only; still 0.x.
- **lefthook**: 2.1.8 (was 2.0.15/2.1.1). Patch-level.
- **publint**: 0.3.21. Incremental.
- **Changesets**: 2.31.0. No native Bun support added; workspace protocol
  workaround still needed.
- **GitHub Actions**: `actions/checkout` v6.0.2 (credentials in
  `$RUNNER_TEMP` now); `oven-sh/setup-bun` v2.2.0. GitHub's Node 20 → 24
  migration deadline is 2026-06-02, so all custom actions and workflow
  setups should be on Node 24.

Separately, the supply-chain threat model has shifted. Notable 2025–2026 npm
incidents (typosquatted packages, compromised maintainer accounts, lifecycle
script abuse, the Shai-Hulud campaigns) have repeatedly involved malware
uploaded as a fresh version that the registry yanks within 1–10 days once
discovered. A trailing-window install policy — don't touch a version until it
has survived community scrutiny for ~2 weeks — is best practice now in
security-conscious teams. We want to:

- State the rule plainly in our guidelines.
- Recommend enforcement tooling (npm-check-updates' `--cooldown`, registry
  publish-time checks, lifecycle-script allowlisting, lockfile discipline).
- Apply it to our own repo, so we eat our own dogfood.

## Design

### Approach

One phase, three parallel workstreams:

1. **Research consolidation.** Two background research agents (already
   dispatched 2026-05-21) verify current versions and ecosystem changes for
   the Bun track and the npm/pnpm/TypeScript track. Their reports replace
   the existing "Last Researched Versions" tables. Anything unverifiable
   from a real source we mark "verify next refresh" rather than
   fabricating.

2. **Supply-chain section authoring.** Author a single canonical
   **Supply-Chain Mitigation** section. It lives in **both** the Bun and
   pnpm monorepo guides (each carries a full copy because the guides are
   meant to be read standalone), with a header note that the two copies
   are kept in sync. The section covers:

   - The 14-day rule (rationale, scope, exceptions).
   - Tooling: `npm-check-updates --cooldown 14`, `pnpm install
     --frozen-lockfile`, `bun audit`, registry queries to check publish
     times (`npm view <pkg> time.<version>`).
   - Lifecycle script hygiene: opt-in lifecycle scripts (`ignoreScripts` /
     `--ignore-scripts`, pnpm's `onlyBuiltDependencies` allowlist, Bun's
     `trustedDependencies` / built-in allowlist).
   - Lockfile discipline: always commit lockfiles, never auto-update
     without review, prefer `--frozen-lockfile` in CI.
   - Provenance checks: prefer packages with npm provenance attestation;
     `npm audit signatures` / `pnpm audit` in CI.
   - Exception process: if a security patch within the 14-day window is
     needed, document the exception in the commit/PR with the CVE and
     reviewer sign-off.

3. **Apply to our own repo.** Sweep `package.json` files on the
   currency-refresh upgrade. Any pin that resolves to a version published
   within the last 14 days gets held at the prior version with a comment.
   Add a recommended local check (one-liner script and/or lefthook hook)
   that surfaces violations on dependency changes.

### Components

Files changed:

- `packages/tbd/docs/guidelines/bun-monorepo-patterns.md` — versions table,
  inline references, appendices, **new Supply-Chain Mitigation section**.
  Add notes on the Rust rewrite, `Bun.Image`, HTTP/3, `bun audit` flags,
  and the Anthropic acquisition consequences (e.g., signing of Claude
  Code as a `bun build --compile` executable).
- `packages/tbd/docs/guidelines/pnpm-monorepo-patterns.md` — versions
  table, inline references, appendices, **new Supply-Chain Mitigation
  section** (content-identical to the Bun copy). Updates for TypeScript 6.0
  / 7.0 Beta, ESLint v10 status, Vitest v4 coverage option changes.
- `packages/tbd/docs/guidelines/typescript-rules.md` — minor refresh; add
  pointer to Supply-Chain section.
- `packages/tbd/docs/guidelines/typescript-cli-tool-rules.md` — Commander
  v14+ patterns still current; verify whether Node `--env-file` should
  supersede the `dotenv` recommendation; refresh as needed.
- `packages/tbd/docs/guidelines/typescript-code-coverage.md` — Vitest v4
  coverage option names (e.g., the removal of `coverage.all`), updated
  installation snippet.
- `packages/tbd/docs/guidelines/typescript-sorting-patterns.md` — stable;
  spot-check only.
- `packages/tbd/docs/guidelines/typescript-yaml-handling-rules.md` —
  verify `yaml@2.x` is still latest; spot-check.
- This repo's `package.json` and any other workspace `package.json` —
  sweep for packages published <14 days ago at upgrade time.

### API Changes

None — this is a documentation and policy change. No `tbd` CLI command
additions.

## Implementation Plan

### Phase 1: All-in-one refresh

- [ ] Receive and consolidate the two research-agent reports (Bun track —
      done 2026-05-21; npm/pnpm track — pending).
- [ ] Rewrite the "Last Researched Versions" table in
      `bun-monorepo-patterns.md` and update the "Last Updated" date to
      2026-05-21.
- [ ] Rewrite the "Last Researched Versions" table in
      `pnpm-monorepo-patterns.md` and update the "Last Updated" date.
- [ ] Search-and-replace stale version numbers in code examples, GitHub
      Actions snippets, and Appendices across both guides.
- [ ] Reconcile claims that may have changed: TypeScript 6.0 / 7.0 Beta
      status, Bun Rust rewrite, Bunup workspace API, Biome 2.4.x
      features, ESLint v10 status, Vitest v4 coverage flags, lefthook
      v2.1.x changes, `bun audit` documentation.
- [ ] Author the **Supply-Chain Mitigation** section and add it to both
      monorepo guides verbatim, with a sync note at the top. Sections:
      14-day rule, enforcement commands, lifecycle script hygiene,
      lockfile discipline, provenance checks, exception process.
- [ ] Add a short pointer to the Supply-Chain section from
      `typescript-rules.md` and `typescript-cli-tool-rules.md`.
- [ ] Spot-check TypeScript guidelines for stale advice (Vitest v4 in the
      coverage doc, Node `--env-file` in the CLI doc, `yaml` package
      version in the YAML doc).
- [ ] Sweep `tbd`'s own `package.json` files: for every entry that would
      be upgraded as part of this refresh, verify the resolved version
      is ≥14 days old. Where it isn't, hold at the prior pin with a
      comment.
- [ ] Document the local check (one-liner script or hook) for the 14-day
      rule, located either in `scripts/` or in the Supply-Chain section.
- [ ] Run `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- [ ] Open a draft PR.

## Testing Strategy

Documentation-only changes — no unit tests. Validate by:

- Running `pnpm format:check` and `pnpm lint:check` over all touched docs.
- Spot-checking rendered Markdown for broken links and stale anchors.
- Manually executing each new shell-command snippet on this machine where
  feasible (e.g., `npx publint`, `ncu --cooldown 14 --help`,
  `npm view typescript time`).
- For the `package.json` sweep: dry-run `pnpm install` after edits and
  confirm the lockfile diff matches the intended pins (no surprise
  upgrades).

## Rollout Plan

- Single PR, merge to main, no version bump needed (guideline-only).
- Re-installable docs: users who have run `tbd setup --auto` will get the
  refreshed guidelines on next `tbd setup --auto` after the next published
  release of `get-tbd`.

## Open Questions

- Canonical home for the Supply-Chain Mitigation section: duplicate
  in-place vs. a new shared `supply-chain-mitigation.md` guideline both
  guides reference? Current plan: duplicate, with a sync header, because
  the guides are read standalone. Revisit if the section grows past
  ~200 lines.
- Should the 14-day rule extend to `devDependencies`? Default: yes, with
  a documented exception for clearly benign tooling on a case-by-case
  basis (because dev tooling — bundlers, linters, test runners — has been
  a high-impact supply-chain attack vector historically).
- Is there a credible automated check for the 14-day rule that runs in
  pre-push or CI? Best candidate: `npm-check-updates --cooldown 14` for
  upgrade-time enforcement. Confirm with the pending npm/pnpm research
  report.
- Should we adopt `bun audit` as a required CI check in the Bun-track
  guide? Likely yes given its arrival as a documented command in 1.3.x.

## References

- `packages/tbd/docs/guidelines/bun-monorepo-patterns.md`
- `packages/tbd/docs/guidelines/pnpm-monorepo-patterns.md`
- Background research agent reports (Bun: 2026-05-21; npm/pnpm: pending).
  Inline citations will be added to the guideline edits.
