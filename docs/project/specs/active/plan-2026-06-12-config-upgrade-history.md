---
title: Config Upgrade History (f06)
description: Redefine config tbd_version as the version that last ran setup, and add a tbd_upgrades history list, as a metadata-only f06 format bump
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Config Upgrade History (f06)

**Date:** 2026-06-12

**Author:** Joshua Levy with LLM assistance

**Status:** Draft

## Overview

The `tbd_version` field in `.tbd/config.yml` is written once, at `tbd init` / fresh
`tbd setup`, and is **never updated again** — not on `tbd setup --auto` (the upgrade
path), not by any migration.
It is also **read by nothing**: the only consumer is the display in `tbd config show`.
So a repo set up with `0.2.4-dev.56.22bf432-dirty` shows that string forever, even after
the binary has been upgraded several times.
The name reads like “current version” but the value means “version at install” — which
is confusing.

This spec does two things, bundled as a single metadata-only format bump (`f06`):

1. **Redefine `tbd_version`** to mean “the version that last ran `tbd setup` in this
   repo,” and update it on every `tbd setup` (including `--auto`).
2. **Add `tbd_upgrades`** — an ordered list of `{ version, at }` entries recording the
   tbd versions that have run setup here, appended whenever the version changes.

The result is a small, honest provenance log in the config: when the repo was first set
up, and each version that has touched it since.

## Goals

- **G1. Accurate current version:** `tbd_version` reflects the version that last ran
  setup, not the install-time version.
  The stale-value confusion goes away.
- **G2. Upgrade history:** `tbd_upgrades` records the versions that actually ran setup
  on this repo, in order, for reference.
- **G3. Honest history:** We record only versions we actually observed running setup.
  We never fabricate intermediate entries (e.g. from `FORMAT_HISTORY.introduced`),
  because those are not necessarily what ran on this repo.
- **G4. No-noise:** History does not grow on no-op re-runs of the same version, and dev
  builds do not spam it.
- **G5. Clean migration:** Existing repos (any format `f01`–`f05`) migrate to `f06` with
  the existing staircase machinery; the first history entry is seeded from the existing
  `tbd_version` stamp.
- **G6. Backward compatibility (MIGRATE):** Old clients (≤ `f05`) fail fast on an `f06`
  config via the existing format-compatibility check, never silently stripping the new
  field.

## Non-Goals

- **No new behavior gated on `tbd_version`/`tbd_upgrades`.** Like today, the field is
  informational. All functional version gating remains on `tbd_format`.
- **No reconstruction of un-recorded history.** We cannot recover versions that ran
  before `f06` beyond the single install-time stamp; we do not try.
- **No new CLI surface** beyond what `tbd config show` already prints (it will now also
  show the history).

## Background

Findings from the current code:

- **Written once:** `createDefaultConfig()`
  ([config.ts:63-80](../../../packages/tbd/src/file/config.ts)) sets `tbd_version` from
  the running `VERSION`, only at `initConfig()` (called by `tbd init` and fresh
  `tbd setup`). No migration touches it.
- **Read by nothing functional:** schema requires it
  ([schemas.ts:296](../../../packages/tbd/src/lib/schemas.ts)); the only consumer is
  `tbd config show` ([config.ts](../../../packages/tbd/src/cli/commands/config.ts)).
  `tbd status` uses the live binary `VERSION`, not the stored value.
- **Separate from `tbd_format`:** `tbd_format` (`f01`…`f05`) is the functional version —
  it drives migration and the “requires a newer version of tbd” gate
  ([tbd-format.ts](../../../packages/tbd/src/lib/tbd-format.ts)). `tbd_version` is pure
  provenance.
- **The fork manifest has its own `tbd_version`** per entry that *is* used (fork
  version-skew guards).
  That is a different field and is out of scope here.

### Migration machinery is gap-tolerant (verified)

A concern during design: does anything assume single-step format increments, given a
repo could jump several revisions at once (e.g. `f02 → f06`)? Audit result: **no.**

- `migrateToLatest` / `describeMigration` are staircases of *sequential* `if` blocks
  (not `else if`), so they cascade through every intermediate step in one call.
  Already tested: `migrates f01 to f05 through all format steps`.
- The common-dir layout does not staircase at all — `writeCommonDirLayout` re-stamps
  `tbd_format: config.tbd_format` directly.
- Compatibility (`isFormatCompatibleWithSupported`) is index-based and gap-tolerant.
- The one numeric path (`formatToNumber`/`assertNotNewerFormat` in setup.ts) uses `>`,
  not `+1`; it only assumes codes are numeric `fNN` (which `f06` is).

The actual risk is the *opposite* of single-increment hardcoding: because the staircase
is hand-maintained, a multi-step jump only works if **every adjacent rung exists and is
wired in**. Forgetting the `f05 → f06` rung would cause a silent stall (config never
reaches `f06`, `tbd_upgrades` never added).
The bump must therefore include all four: the `migrate_f05_to_f06` function, the rung in
`migrateToLatest`, the rung in `describeMigration`, and the `CURRENT_FORMAT` change — as
documented in the tbd-format.ts header.
A test that migrates `f02 → f06` guards against a dropped rung.

### Why `f06` and not folding into `f05`

`f05` (forkable docs) introduced in `0.3.0` is **unreleased** (latest published is
`0.2.3` / `f04`). We still make this a distinct `f06` rather than editing `f05`, so the
change exercises a real `f05 → f06` migration (there are dev/test repos already on
`f05`). For released users (`f04`), the next release effectively jumps `f04 → f06`,
which the staircase handles by running `f04 → f05 → f06` internally.

## Design

### Data model

`tbd_version: string` — redefined semantics: “the version that last ran `tbd setup` in
this repo.” Updated on every setup.
(Still a required string; field name unchanged for continuity.)

`tbd_upgrades: UpgradeEntry[]` — new, ordered oldest-to-newest:

```yaml
tbd_format: f06
tbd_version: 0.3.0            # version that last ran setup here
tbd_upgrades:
  - version: 0.2.4-dev.56.22bf432   # seeded from the prior tbd_version (no `at`: install time unknown)
  - version: 0.3.0
    at: 2026-06-12T09:10:00Z
```

`UpgradeEntry`:

- `version: string` — required.
- `at: string (datetime)` — **optional**. Real, observed stamps carry a timestamp; the
  migration-seeded first entry omits it because we do not know when the original install
  happened. (Honesty over a fabricated date.)

### Two distinct operations

1. **Seed (one-time, in the migration).** `migrate_f05_to_f06` is a pure transform: if
   the config has an existing `tbd_version` and no `tbd_upgrades`, it creates
   `tbd_upgrades: [{ version: <existing tbd_version> }]` (no `at`). It does not know the
   running `VERSION`. It also stamps `tbd_format: f06`.

2. **Stamp (every setup, format-independent).** A new setup-time helper sets
   `tbd_version = VERSION` and, **if `VERSION` differs from the last `tbd_upgrades`
   entry’s version**, appends `{ version: VERSION, at: <now> }`. This runs on every
   `tbd setup` — including same-format upgrades (e.g. `0.3.0 → 0.3.1`, both `f06`) where
   no migration fires — so the history keeps advancing without format churn.
   Dedupe by “differs from last entry” keeps no-op re-runs and identical dev rebuilds
   from spamming the list.

Seed + stamp compose: a multi-revision jump (say install `0.1.5`, now `0.3.0`) yields
`[{0.1.5}, {0.3.0, at}]` — two honest points, no synthetic intermediates (G3).

### Where stamping hooks in

- **Fresh setup / init:** `createDefaultConfig()` seeds `tbd_upgrades` with the current
  version (with `at`), so a brand-new repo starts with a one-entry history.
- **Existing repo (`tbd setup`):** stamping is applied in the setup path next to the
  migration write. Both the migrated-config write
  ([data-context.ts `ensureSharedDataSyncLayout`](../../../packages/tbd/src/cli/lib/data-context.ts))
  and the already-current path must run the stamp, so the version advances even when no
  migration is needed.
  Exact placement chosen during implementation to keep it on the single explicit write
  path; if the stamp changes the config it is persisted via `writeConfig`.

### Components

- `schemas.ts` — `UpgradeEntrySchema`, `tbd_upgrades` on `ConfigSchema`, redefine
  `tbd_version` doc comment, add `tbd_upgrades` to `CONFIG_FIELD_ORDER` (after
  `tbd_version`).
- `tbd-format.ts` — `f06` in `FORMAT_HISTORY`; `migrate_f05_to_f06` (seed); rung in
  `migrateToLatest`; rung in `describeMigration`; bump `CURRENT_FORMAT`; add
  `tbd_upgrades` to `RawConfig`.
- `config.ts` — `createDefaultConfig` seeds history; a `stampVersion(config, version)`
  helper (or inline) for the setup write path; `writeConfig` comment for the new
  section.
- setup / data-context — call the stamp on every setup path.
- `config.ts` command — print `tbd_upgrades` in `tbd config show`.

### API Changes

No public API changes.
Config schema gains one optional-shaped field (required array with a default), gated
behind `f06` so old clients fail fast.

## Implementation Plan

Single phase — the change is small and cross-cuts a few files that must move together
(schema + format + setup) to keep the format consistent.

### Phase 1: f06 upgrade history

- [ ] Add `UpgradeEntrySchema` and `tbd_upgrades` to `ConfigSchema`; redefine the
  `tbd_version` doc comment; add `tbd_upgrades` to `CONFIG_FIELD_ORDER`.
- [ ] Add `tbd_upgrades` to `RawConfig`; add `f06` to `FORMAT_HISTORY`; implement
  `migrate_f05_to_f06` (seed history from existing `tbd_version`); wire the rung into
  `migrateToLatest` and `describeMigration`; bump `CURRENT_FORMAT` to `f06`.
- [ ] Seed `tbd_upgrades` in `createDefaultConfig`; add the setup-time stamp helper (set
  `tbd_version = VERSION`, append-if-changed with timestamp) and call it on every setup
  path.
- [ ] Update `writeConfig` comment block and `tbd config show` to render history.
- [ ] Tests: `f02 → f06` and `f05 → f06` migrations seed correctly; multi-revision jump
  lands on `f06` (dropped-rung guard); stamp appends on version change; stamp is a no-op
  on same version (dedupe); fresh config has a one-entry history; old client rejects
  `f06`.
- [ ] Build, typecheck, lint, run the format + config test suites.

## Testing Strategy

Unit tests in `packages/tbd/tests/tbd-format.test.ts` and the config file tests:

- **Migration seeding:** an `f05` (and an `f02`) config with `tbd_version: X` migrates
  to `f06` with `tbd_upgrades: [{version: X}]` (no `at`), `tbd_format: f06`.
- **Multi-revision jump:** an `f02` config reaches `f06` in one `migrateToLatest` call
  (guards against a missing `f05 → f06` rung) and accumulates the full `changes` log.
- **Stamping:** appends `{version, at}` when `VERSION` differs from the last entry;
  no-op when equal (dedupe covers identical dev rebuilds and plain re-runs).
- **Fresh init:** `createDefaultConfig` produces a one-entry history with `at`.
- **Old-client gate:** an `f05`-supporting client rejects an `f06` config
  (`isFormatCompatibleWithSupported('f06', 'f05') === false`).

## Rollout Plan

Ships in the next tbd release.
On first `tbd setup` after upgrade, existing repos migrate `… → f06`; the migration and
the new history land as a tracked diff on the user’s branch (the standard
config-migration “publish” step, already surfaced by `notifyConfigMigrated`) and should
be committed. No user action beyond the normal `tbd setup --auto`.

## Backward Compatibility

Per `backward-compatibility-rules.md`:

- **File formats: MIGRATE.** Config schema change handled by the format staircase; `f06`
  added with a migration; old clients fail fast via `isCompatibleFormat`.
- **Code types / signatures: DO NOT MAINTAIN.** Internal helpers may change freely.
- **Library / Server APIs: N/A.**

## Open Questions

- None blocking. (Resolved during design: distinct `f06` over folding into `f05`; seed
  entry omits `at`; dedupe by “differs from last entry”; no fabricated intermediates.)

## References

- `packages/tbd/src/lib/tbd-format.ts` — format history + migration staircase
- `packages/tbd/src/file/config.ts` — config read/write/init
- `packages/tbd/src/lib/schemas.ts` — `ConfigSchema`, `CONFIG_FIELD_ORDER`
- `docs/project/specs/done/plan-2026-06-11-forkable-docs.md` — the `f05` format bump
- `tbd guidelines backward-compatibility-rules`

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
