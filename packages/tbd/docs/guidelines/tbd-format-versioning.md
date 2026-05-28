---
title: tbd On-Disk Format Versioning
description: Rules for bumping tbd's on-disk format, handling old clients in new repos, and migrating new clients in old repos gracefully and idempotently
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
## tbd On-Disk Format Versioning

tbd uses two synchronized format markers to gate compatibility between clients of
different versions and a repository’s on-disk state:

- `.tbd/config.yml` → `tbd_format` (the branch-visible format marker for the checkout
  config).
- `$GIT_COMMON_DIR/tbd/layout.yml` → `tbd_format` (the repo-scoped local layout marker
  for the shared common-dir sync machinery).

`packages/tbd/src/lib/tbd-format.ts` is the SINGLE SOURCE OF TRUTH: `CURRENT_FORMAT`,
`FORMAT_HISTORY`, the per-step migrations, and `formatUpgradeMessage` all live there.
When bumping `fNN` → `fNN+1` follow the rules below.

### Old client in a newer repo: fail closed, never silently downgrade

An older `tbd` (built with a smaller `CURRENT_FORMAT`) that encounters either marker
with a future `tbd_format` MUST:

- Throw `IncompatibleFormatError` (`packages/tbd/src/file/config.ts`) or
  `CommonDirLayoutError` with
  `formatUpgradeMessage('<location>', foundFormat, supportedFormat)` and exit non-zero.
- Tell the user the supported format, the found format, and the upgrade command
  (`npm install -g get-tbd@latest`).
- Never silently strip new config fields, never fall back to a legacy code path, never
  overwrite the new marker with an older format.

This is enforced at two read points: `checkFormatCompatibility` in
`readConfigWithMigration` (config) and `isCompatibleFormat` in `validateCommonDirLayout`
(layout). Both are exercised by `tests/cli-format-compatibility.tryscript.md` and
`tests/cli-shared-common-dir-worktree.tryscript.md`.

`tbd doctor` and `tbd doctor --fix` must SURFACE the upgrade message clearly, not hide
it behind a generic “invalid config” or “worktree corrupted” error.
`checkConfig` and `checkCommonDirLayout` in `packages/tbd/src/cli/commands/doctor.ts`
distinguish these errors and report the actionable upgrade text.

### New client in an older repo: migrate gracefully and idempotently

When a new client loads an older repo migration runs automatically.
It MUST:

1. **Be idempotent.** Re-running migration after success is a no-op.
   Re-running after a partial failure picks up where it left off and reaches the same
   final state.

2. **Hold the shared lock for the duration** via `withSharedDataSyncLock`
   (`$GIT_COMMON_DIR/tbd/locks/data-sync.lock`). Concurrent agents from sibling
   worktrees must not race migration.
   Reads probe first and acquire the lock only when migration is actually needed;
   writers always hold the lock.

3. **Order writes so each intermediate state is recoverable**:

   1. Migrate local on-disk state first (worktree layout, data files, branch ownership).
   2. Write `$GIT_COMMON_DIR/tbd/layout.yml` with the new format.
   3. Write `.tbd/config.yml` with the new format LAST.

   The config write is the “publish” step that locks out older clients, so it MUST be
   the final action of a successful migration.

4. **Be safe to interrupt at every step.** If migration crashes before the config bump
   the repo is still usable by the old client (it sees the old format).
   If migration reaches the config bump the shared layout MUST already be valid and
   self-consistent so old clients see the closed door and new clients see a complete
   layout.

5. **Use signing-agnostic commits** for every internal `tbd-sync` write.
   All internal commits go through `gitCommit()` (`packages/tbd/src/file/git.ts`) which
   sets `-c commit.gpgsign=false`. Machine-generated data commits must not depend on the
   user’s ambient `commit.gpgsign` config: in signed-by-default environments without a
   usable key a failed sign leaves migration unfinished and surfaces as a “worktree
   corrupted” failure on the next command.

### Mismatch recovery: route through `tbd doctor --fix`

If the two markers disagree (partial migration, manual edit, half-applied upgrade)
normal mutating commands fail closed and point the user at `tbd doctor --fix`. The
contract:

- `tbd doctor` diagnoses the mismatch (`checkCommonDirLayout`).
- `tbd doctor --fix` acquires the shared lock and rewrites `layout.yml` from config via
  `writeCommonDirLayout` when the format is compatible, or surfaces the future-format
  upgrade message when it is not.
- Error messages from `validateCommonDirLayout` name `tbd doctor --fix` as the primary
  remediation; the manual `rm "$(git rev-parse --git-common-dir)/tbd/layout.yml"` hint
  is a secondary fallback.

### Required pieces when adding a new format

When bumping from `fNN` to `fNN+1`:

1. Add the new format to `FORMAT_HISTORY` in `packages/tbd/src/lib/tbd-format.ts`.
2. Add a `migrate_fNN_to_fNN+1()` migration function.
3. Bump `CURRENT_FORMAT` to the new ID.
4. Add unit tests proving (a) `fNN` migrates to `fNN+1` idempotently and (b) older
   format-compatibility checks reject `fNN+1`.
5. Add a golden tryscript scenario for the future-format rejection case (an `fNN`-era
   stand-in client against the migrated repo).
6. Update `checkConfig` and `checkCommonDirLayout` in `doctor.ts` if the new format
   requires new diagnostics.
7. Document the user-visible upgrade in the next `CHANGELOG.md` entry (assembled by the
   `cut-release` flow from commits): “every machine that touches this repo must upgrade
   tbd to the new version, older clients will fail closed.”

### Reference design

Implementation reference: the `f03` → `f04` migration that introduced the shared
common-dir sync worktree
(`docs/project/specs/active/plan-2026-05-17-shared-common-dir-sync-worktree.md`, §Format
And Layout Versioning, §Migration And Compatibility, §Post-Review Hardening).
