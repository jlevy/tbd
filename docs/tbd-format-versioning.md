---
title: tbd On-Disk Format Versioning
description: Internal guide for bumping tbd's on-disk format, handling old clients in new repos, and migrating new clients in old repos gracefully and idempotently
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# tbd On-Disk Format Versioning

An internal contributor guide for the `get-tbd` codebase, not a guideline shipped to tbd
users. It documents how to evolve tbd’s own on-disk format (`fNN` IDs in
`.tbd/config.yml` and `$GIT_COMMON_DIR/tbd/layout.yml`) without breaking older clients
or corrupting older repos.

tbd currently uses two synchronized format markers to gate compatibility between clients
of different versions and a repository’s on-disk state:

- `.tbd/config.yml` → `tbd_format` (the branch-visible format marker for the checkout
  config).
- `$GIT_COMMON_DIR/tbd/layout.yml` → `tbd_format` (the repo-scoped local layout marker
  for the shared common-dir sync machinery).

[packages/tbd/src/lib/tbd-format.ts](../packages/tbd/src/lib/tbd-format.ts) is the
current single source of truth: `CURRENT_FORMAT`, `FORMAT_HISTORY`, the per-step
migrations, and `formatUpgradeMessage` all live there.
`CURRENT_FORMAT` is f08 and currently acts as the maximum readable format, automatic
migration target, and fresh-repository default.
The common-dir layout mirrors the active config marker.
When bumping `fNN` → `fNN+1`, follow the rules below and first decide whether the change
is universal or explicitly activated.

Generated session and closing launchers are content-managed artifacts, not additional
on-disk format markers.
They first run the installed CLI only if `tbd config get tbd_format` succeeds.
If that compatibility probe fails, they read the single exact `tbd_fallback_version`
from `.tbd/config.yml`, validate it as SemVer, and invoke that package.
As a result:

- compatible patch and minor releases update one central config pin without rewriting
  every launcher;
- launcher files change only when their actual behavior changes;
- a real format boundary still fails closed and uses the exact reviewed fallback.

`tbd_fallback_version` is an additive f07 top-level key, so f07 clients preserve it and
its introduction does not itself require a format bump.
Do not bump `tbd_format` merely for a compatible implementation change to a
content-managed script.
Do bump when repository data or a format-stamped managed surface becomes incompatible
with older clients.

`AGENT_INTEGRATION_FORMAT` currently aliases `CURRENT_FORMAT`, so a repository-format
bump also changes generated integration markers.
That coupling is valid for universal migrations but must be separated or explicitly
retained when a future format is opt in.

## When a Config Schema Change Needs a Bump

Adding, removing, or changing the meaning of a config field is a format change.
Bump for it, and bump *unconditionally* in the release that ships the field, never
conditionally on whether a repository uses the feature: `tbd_format` is what tells an
older client whether it may rewrite this config at all, and a config can acquire the new
block by hand (or by a teammate’s commit) at any time.
A conditional stamp leaves exactly the window the gate exists to close.

As of `f07` `ConfigSchema` preserves unknown top-level keys, so a *purely additive* key
introduced after f07 survives a round trip through any f07-or-later client and does not
need its own bump. That does not apply to clients released before the key existed and
before f07: they parse in strip mode and drop what they do not know.
The `integrations` block was lost that way three times during the Linear pilot, which is
what f07 exists to stop.

Bump when: existing field meaning changes, a field is removed or renamed, or losing the
new field to a pre-f07 client would be damaging.
Do not bump for: additive keys once every client in use is f07 or later.

**Release sequencing.** Never commit a new format stamp to a repository before the
client that supports it is published.
The stamp locks out every unpublished-from client immediately, including agent sessions
that install `get-tbd@latest` at startup, and the upgrade message it prints cannot be
satisfied until the release is on npm.
Land the bump, publish, then let repositories stamp.

## Explicit Activation for Additive Data Collections

Some future collections are additive on disk but unsafe for an older writer to ignore.
Native comments are the first such case: an f08 client can transfer an unknown
`comments/` path, yet its broad stage, recovery, and source-clearing operations do not
validate immutability or guarantee preservation.
Treating the collection as “just files” would make an old client appear compatible while
it could delete or rewrite durable records.

The candidate f09 native-comment format is therefore a narrow exception to the normal
automatic migration rule.
Changing `CURRENT_FORMAT` alone would make every existing repository migrate and every
fresh repository start on f09 before users had inventoried their writers or elected to
enable comments. Before f09 is implemented, split these roles in code even if the final
constant names differ:

- **Readable ceiling:** newest repository format the binary can parse and preserve
- **Automatic migration target:** format reached by ordinary setup or first write
- **Fresh-repository default:** format stamped by a new initialization
- **Active repository format:** committed `tbd_format` selected for one repository
- **Common-dir layout format:** local marker that must agree with the active repository
- **Generated integration format:** compatibility marker for managed agent surfaces

Supporting f09 and activating f09 are separate events.
The required sequence is:

1. Ship an f08-compatible preservation release that guards every comments and quarantine
   path during sync, workspace/outbox handling, import, repair, and history recovery.
2. Establish that release as the minimum binary for every known writer and complete the
   format-evidence gate.
3. Release a binary whose readable ceiling includes f09 while its automatic migration
   target and fresh default remain f08.
4. Run an explicit enable command that verifies writer inventory, writes the complete
   candidate layout, and commits the f09 config stamp only after local state is valid.
5. Distribute that commit before any native record is created; every writer rechecks the
   active format while holding the shared lock.

Git cannot fence a pre-preservation binary working from a stale clone that has not seen
the activation commit.
The enable command must report this limit and require bounded writer-inventory evidence;
the format marker is a compatibility gate, not a distributed lock.

The exact candidate contract and open gates are maintained in the
[native comment architecture](project/architecture/current/arch-native-comments.md).
Until those gates close, f08 remains the readable ceiling, migration target, and fresh
default in released code.

## Old Client in a Newer Repo: Fail Closed, Never Silently Downgrade

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

## New Client in an Older Repo: Migrate Gracefully and Idempotently

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

4. **Be safe to interrupt at every step.** If migration crashes before the config bump,
   the repo is still usable by the old client (it sees the old format).
   If migration reaches the config bump, the shared layout MUST already be valid and
   self-consistent so old clients see the closed door and new clients see a complete
   layout.

5. **Use signing-agnostic commits** for every internal `tbd-sync` write.
   All internal commits go through `gitCommit()` (`packages/tbd/src/file/git.ts`) which
   sets `-c commit.gpgsign=false`. Machine-generated data commits must not depend on the
   user’s ambient `commit.gpgsign` config: in signed-by-default environments without a
   usable key a failed sign leaves migration unfinished and surfaces as a “worktree
   corrupted” failure on the next command.

## Mismatch Recovery: Route Through `tbd doctor --fix`

If the two markers disagree (partial migration, manual edit, half-applied upgrade),
normal mutating commands fail closed and point the user at `tbd doctor --fix`. The
contract:

- `tbd doctor` diagnoses the mismatch (`checkCommonDirLayout`).
- `tbd doctor --fix` acquires the shared lock and rewrites `layout.yml` from config via
  `writeCommonDirLayout` when the format is compatible, or surfaces the future-format
  upgrade message when it is not.
- Error messages from `validateCommonDirLayout` name `tbd doctor --fix` as the primary
  remediation; the manual `rm "$(git rev-parse --git-common-dir)/tbd/layout.yml"` hint
  is a secondary fallback.

## Required Pieces When Adding a New Format

For a universal migration from `fNN` to `fNN+1`:

1. Add the new format to `FORMAT_HISTORY` in `packages/tbd/src/lib/tbd-format.ts`.
2. Add a `migrate_fNN_to_fNN+1()` migration function.
3. Bump `CURRENT_FORMAT` to the new ID.
4. Add unit tests proving (a) `fNN` migrates to `fNN+1` idempotently and (b) older
   format-compatibility checks reject `fNN+1`.
5. Add a golden tryscript scenario for the future-format rejection case (an `fNN`-era
   stand-in client against the migrated repo).
6. Update `checkConfig` and `checkCommonDirLayout` in `doctor.ts` if the new format
   requires new diagnostics.
7. Document the user-visible upgrade in the next `CHANGELOG.md` entry (assembled at
   release time from commits): “every machine that touches this repo must upgrade tbd to
   the new version, older clients will fail closed.”

For an explicitly activated format, complete the same history, compatibility,
diagnostic, and release-note work, but do not point ordinary migration or fresh setup at
the new format. Instead, add tests that prove:

1. A supporting binary reads both the prior default and the activated format.
2. Ordinary setup, first write, and fresh initialization remain on the prior default.
3. The explicit activation path publishes local layout state before the config stamp.
4. A writer rechecks the active format under the shared lock.
5. A prior client fails closed after it observes the activation commit.
6. The preservation-floor client carries the new collection unchanged before activation,
   including through every broad Git and recovery path.

## Reference Design

Implementation reference: the `f03` → `f04` migration that introduced the shared
common-dir sync worktree
([docs/project/specs/done/plan-2026-05-17-shared-common-dir-sync-worktree.md](project/specs/done/plan-2026-05-17-shared-common-dir-sync-worktree.md),
§Format And Layout Versioning, §Migration And Compatibility, §Post-Review Hardening).

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
