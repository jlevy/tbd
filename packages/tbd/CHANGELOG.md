# get-tbd

## 0.2.1

A drop-in patch on top of v0.2.0. **No on-disk format change** (`f04` stays `f04`), so
any machine already on v0.2.0 can upgrade without a migration.
The headline is hardened recovery when a repo’s issue-sync branch and local history have
drifted into unrelated git histories.

### Features

- **Unrelated-history detection and non-destructive rescue**: tbd now recognizes when
  the local issue store and the remote `tbd-sync` branch share no common git history — a
  corruption/misconfiguration that previously surfaced as a confusing mid-sync failure.
  - `tbd doctor` reports it as a hard `✗` finding (and exits non-zero, matching v0.2.0’s
    doctor contract).
  - `tbd doctor --fix` performs a **non-destructive rescue** that preserves your issue
    files instead of discarding either history.
  - `tbd sync` detects the condition up front rather than failing partway through, and a
    missing or unhealthy remote sync branch is re-established as a fresh orphan rather
    than left broken.
- **`tbd prime`** now reminds you that `tbd setup --auto` refreshes the installed skills
  and settings, so a long-running agent session knows how to pick up updates.

### Fixes

- **Release notes come from the CHANGELOG**: the GitHub Release body is now populated
  from this `## X.Y.Z` section instead of the old bare `Release vX.Y.Z` fallback, and
  tag publication is gated on a green main CI run for the exact tagged commit.
- **Skill no longer restates a drifting type list**: the bundled tbd skill stopped
  hard-coding the issue-type enum (which had drifted from the CLI once `chore` was
  added) and now points agents to `tbd create --help` for the authoritative list.
- **Generated skills are protected from downgrade**: every generated `SKILL.md` now
  carries a `format=fNN` stamp, and `tbd setup` refuses to overwrite a skill written by
  a newer tbd (telling you to upgrade) instead of silently rolling it back.

### Guidelines & skills

These ship inside the package and are read by agents via `tbd guidelines …` and
`tbd skill`:

- **`cli-agent-skill-patterns` guideline — new guidance for authoring CLI-backed skills
  and handling their upgrades:**
  - **Route, don’t restate**: when a skill is backed by a CLI, that CLI’s own `--help`
    and informational subcommands are the authoritative reference layer.
    The skill should point to them rather than copying flags, types, and output formats
    that then drift (the type-enum drift fixed above is exactly this failure mode).
  - **When to bump the `fNN` format**: reserve a format bump for changes big enough to
    need an explicit migration.
    Routine content updates ship by regenerating the surface on the next `setup` — no
    bump, no migration — so the format code does not churn on every edit.
  - **Upgrades are opt-in, never silent**: a tool only rewrites a user’s committed files
    on an explicit `setup`; a `SessionStart` hook should run the read-only `prime`, not
    `setup`.
  - **Overwritten surfaces must be guarded**: stamp and guard each generated surface (or
    run the format check before writing anything) so an older tool cannot
    partial-downgrade a newer committed skill.
- The bundled **skill baseline** stops over-documenting CLI-backed commands and leans on
  `--help` for the authoritative flag/type reference.

### Security

- Lockfile is byte-identical to v0.2.0 — no manifest changes and no new advisories
  (`pnpm audit --prod` clean, `pnpm check:package-age` reports 0 violations).

**Full commit history**: https://github.com/jlevy/tbd/compare/v0.2.0...v0.2.1

## 0.2.0

**This release ships a new on-disk format (`f03` → `f04`). Every machine that touches a
tbd-managed repository must upgrade to v0.2.0; older clients fail closed.** See
“Upgrading” below if you have a multi-worktree setup or are coming from `v0.1.30`.

### Features

- **Shared common-dir sync worktree**: the local issue-sync worktree moves out of the
  per-checkout `.tbd/data-sync-worktree/` and into the shared
  `$GIT_COMMON_DIR/tbd/data-sync-worktree/`. Multi-worktree repos no longer hit the
  “`tbd-sync` is already used by worktree” failure when a sibling checkout runs `tbd`.
  All linked worktrees in a repo share one issue store, one branch checkout, and one
  lock.
- **`$GIT_COMMON_DIR/tbd/layout.yml`** stamps the on-disk layout with the same
  `tbd_format` ID as the per-checkout config, so the repo-scoped state and the
  branch-visible config are versioned independently and validated against each other on
  every read.
- **Migration affordance**: `tbd doctor --fix` now performs the `f03 → f04` migration
  directly (legacy worktree migration, shared `layout.yml` write, and config bump under
  the shared `data-sync.lock`). Before, you had to know to run `tbd sync` for the
  migration to happen.
- **`tbd doctor` exits non-zero on hard `✗` findings** — future-format markers, invalid
  config, corrupted issue files.
  Warning-level (`⚠`) findings still exit 0. CI and scripts can now gate on doctor’s
  exit code.
- **`tbd status` no longer says “unhealthy”** for the common “shared worktree not
  initialized yet” case.
  It now says `(not initialized) — Run: tbd sync (or tbd doctor --fix) to initialize`.

### Upgrade contract

- Every machine that touches a tbd-managed repo must upgrade.
  Older clients running against an `f04` repo will fail closed on most commands with an
  explicit upgrade message and exit non-zero.

- **Known pre-existing quirk on `v0.1.30`**: `tbd doctor` against an `f04` repo on
  `v0.1.30` reports `✗ Config file - Invalid config file` with exit 0 instead of the
  clear “newer tbd version” upgrade message.
  If you see that, run `npm install -g get-tbd@latest` — do not try `tbd doctor --fix`
  on the older client.
  `v0.2.0`’s `doctor` is fixed to surface the upgrade message clearly.

- **Multi-worktree config bump notice**: when the first command in a checkout migrates
  that checkout’s `.tbd/config.yml` from `f03` to `f04`, tbd now prints to stderr:

  ```
  • tbd_format f03 → f04: .tbd/config.yml updated in this checkout.
    Commit on this branch or merge main to publish the format upgrade.
  ```

  Expect to see this once per checkout that lacks the bump commit; commit (or merge
  `main` into) the per-branch config diff to publish.

### Fixes

- **Internal `tbd-sync` commits are signing-agnostic**: machine-generated commits to the
  data-sync branch now pass `-c commit.gpgsign=false`, so users with
  `commit.gpgsign=true` and no usable signing key no longer see “worktree corrupted” /
  “gpg failed to sign” stalls during migration or sync.
- **Shared-lock boundary covers init and repair**: every code path that initializes or
  repairs the shared layout (`tbd sync`, `tbd doctor --fix`, `tbd init`, the
  data-context read path) now runs inside `withSharedDataSyncLock`, preventing
  concurrent agents from sibling worktrees from racing migration.
- **Read-only commands skip the shared lock when state is steady** — locking only kicks
  in when first-use initialization, migration, or repair is actually required.
- **`tbd doctor --fix` repairs a layout/config `tbd_format` mismatch** by rewriting
  `layout.yml` from the trusted config.
  A future-format layout (e.g. a marker from a newer tbd) is surfaced as
  `requires newer tbd` and is never silently downgraded.

## 0.1.30

### Patch Changes

- 6d706cd: Modernize multi-agent skills and hooks setup.

  `tbd setup --auto` now installs the portable Agent Skill at
  `.agents/skills/tbd/SKILL.md` (the cross-agent standard path read by Codex, Gemini
  CLI, Cursor, Copilot, Amp, OpenCode, and others) and mirrors the identical payload to
  `.claude/skills/tbd/SKILL.md` for Claude Code.
  - **Codex hooks**: setup writes `.codex/hooks.json` plus Codex-native scripts
    (SessionStart/PreCompact run `tbd prime`, PostToolUse reminds about `tbd sync` after
    `git push`, optional SessionStart ensures `gh`). Codex hooks reference only
    `.codex/`, never `.claude/`.
  - **Compact AGENTS.md block**: the managed `AGENTS.md` section is now a short
    bootstrap that points to `tbd prime`/`tbd skill`/`tbd shortcut --list`/
    `tbd guidelines --list` instead of embedding the full skill.
  - **Format-version guard**: generated artifacts carry an integration-format stamp.
    Setup self-upgrades older blocks in place, but refuses to overwrite an artifact
    written by a newer tbd, telling you to run `npm install -g get-tbd@latest`. This
    makes version pinning safe across a team.
  - **Pinned runner fallback**: generated session scripts are local-first, then a
    version-pinned `npx get-tbd@<version>` fallback (never unpinned).
  - **Agent-targeting flags**: `--all`, `--claude`, `--codex`, `--skip-claude`,
    `--skip-codex`.
  - **Distribution copy**: a committed `skills/tbd/SKILL.md` for skills.sh-style
    installers (`npx skills add`) and GitHub browsing.
  - `tbd doctor` and `tbd status` now report all of these surfaces.

  Backwards compatible: existing Claude Code installs keep working and are upgraded in
  place on the next `tbd setup --auto`.

## 0.1.29

### Patch Changes

- Documentation release: agent-skill guidelines refresh and supply-chain hardening.
  - Rewrote the `cli-agent-skill-patterns` guideline into a broad, multi-agent **Agent
    Skills & CLI Integration Patterns** guide: a non-dogmatic simple baseline (one
    `SKILL.md`), a 15-agent integration matrix (Claude Code, Codex, Cursor, Copilot,
    Gemini CLI, Windsurf, Cline, Aider, opencode, Amp, Jules, Goose, Zed, Factory, pi),
    the `AGENTS.md` / Agent Skills open-standard model, CLI-as-skill vs.
    MCP guidance, a CLI install-vs-zero-install section, and security/testing/versioning
    sections.
  - Added a new **`supply-chain-hardening`** guideline
    (`tbd guidelines supply-chain-hardening`): the cross-ecosystem 14-day cool-off plus
    Node/pnpm/Bun enforcement (lifecycle-script allowlists, lockfile discipline,
    `ncu --cooldown`, a CI audit gate, a pre-push age guard, and the exception process),
    strongly recommended for every repo and referencing
    github.com/jlevy/supply-chain-hardening for the full playbooks.
    De-duplicated the Supply-Chain Mitigation content out of the bun and pnpm monorepo
    guides into this standalone guideline.
  - Fixed generated skill/agent files: `tbd setup` no longer emits a stray mid-document
    YAML frontmatter block in `.claude/skills/<tool>/SKILL.md` or the `AGENTS.md`
    integration section, so the generated files are stable and idempotent under Prettier
    and flowmark.

## 0.1.28

### Patch Changes

- 2322a95: Clarify dependency direction in `tbd show` output with `Blocks:` and
  `Blocked by:` comments.
- Fix `tbd doctor` “Temp files” check: display the actual scanned path
  (`.tbd/data-sync/issues`) instead of the stale `.tbd/issues`, and widen the filter to
  catch `atomically`’s `*.md.tmp-NNNN` leftover intermediates.
- Refresh Bun/pnpm monorepo and TypeScript guidelines to May 2026 versions (Bun 1.3.x,
  TS 6.0/7.0 Beta, pnpm 11, ESLint 10, Vitest 4.1, Zod 4, Commander 15, Biome 2.4) and
  add a normative Supply-Chain Mitigation section to both monorepo guides codifying a
  14-day package-age rule with lockfile discipline, provenance checks, and exception
  process.
- Bump `yaml` to `~2.8.3` (resolves to 2.8.4) to patch GHSA-48c2-rrv3-qjmp (moderate
  stack-overflow DoS on deeply nested YAML); range narrowed from `^2.8.2` to `~2.8.3` so
  the resolved minor satisfies the project’s 14-day package-age rule.

## 0.1.27

### Patch Changes

- e166f14: Reject invalid issue titles before writing issue files, skip parse-invalid
  issue files without crashing, and report invalid issue files in `tbd doctor`.

## 0.1.26

### Patch Changes

- c9da6aa: Auto-resolve ids.yml merge conflicts during sync and doctor --fix, add
  merge=union gitattributes inside worktree to prevent future conflicts, fix CI badge
  scope, remove dead code, and update dependencies.

## 0.1.25

### Patch Changes

- Fix short-ID mapping loss during concurrent creation, improve doctor check ordering,
  resolve Windows CI test flakiness, and add research docs for orchestration and
  knowledge architecture.

## 0.1.24

### Patch Changes

- 71d6033: Bug fixes for concurrent create race conditions, migration safety, doctor
  history scanning, lockfile defaults, and sync status reporting.

## 0.1.23

### Patch Changes

- e746cce: Fix sync flag handling, remove unused CLI flags, and fix Windows CI timeout

## 0.1.22

### Patch Changes

- b98e317: Fix ID mapping loss during git merges with automatic reconciliation and merge
  protection

## 0.1.21

### Patch Changes

- 7948df2: Fix outbox sync bulk save noise, add deterministic YAML field ordering, and
  fix list sort order stability.

## 0.1.20

### Patch Changes

- 703f84f: Fix workspace gitignore handling, add parent context display for child beads,
  and new documentation guidelines

## 0.1.19

### Patch Changes

- 4586df7: Bug fixes: prevent .tbd root detection from finding spurious .tbd/ in
  subdirectories, make baseDir required in path functions to prevent subdirectory bugs,
  show relative paths in uninstall preview output, and fix tryscript test expectations
  for config output format.

## 0.1.18

### Patch Changes

- 0feb918: Bug fixes and stability improvements: YAML duplicate key handling after merge
  conflicts, sync debug log branch fix, beads import priority mapping, EPIPE pager
  handling, improved error cause chains, workspace save/import progress logging, and
  test stability fixes.

## 0.1.17

### Patch Changes

- 3f1a09c: Add interactive markdown rendering with pagination for doc commands
  (guidelines, shortcuts, templates) and improve YAML frontmatter styling with syntax
  highlighting.

## 0.1.16

### Patch Changes

- 78d4671: Bug fixes and improvements including doctor remote count fix, init git root
  resolution, JSON mode options suppression, streamlined sync outbox workflow, and
  updated default no-args behavior.

## 0.1.15

### Patch Changes

- 6062050: Documentation consolidation: new shortcuts directory, comprehensive
  TypeScript monorepo and CLI guidelines, and updated README with new shortcuts and
  guidelines.

## 0.1.14

### Patch Changes

- 65b691f: Two-tier prefix validation with --force override, YAML handling improvements
  with Zod validation, and various bug fixes.

## 0.1.13

### Patch Changes

- Workspace sync feature, child bead ordering hints, unified review-code shortcut, and
  various improvements.

## 0.1.12

### Patch Changes

- 1509909: Bug fixes for sync reliability, stats output redesign, and documentation
  improvements.

## 0.1.11

### Patch Changes

- Terminal design system, shortcut improvements, and bug fixes

## 0.1.10

### Patch Changes

- c2cff07: Fix detached HEAD worktree handling for users upgrading from older tbd
  versions. Auto-repairs worktrees that were created before the detached HEAD
  improvement, ensuring sync operations preserve the working directory correctly.

## 0.1.9

### Patch Changes

- 2809883: Worktree robustness improvements, setup bug fixes, and documentation updates.
  Key changes include automatic worktree detection and repair, graceful handling of
  already-migrated data, bypassing parent repo hooks in worktree commits, improved
  .gitignore management on upgrade, and simplified agent integration documentation.

## 0.1.8

### Patch Changes

- Rename npm package from tbd-git to get-tbd, add --specs flag for tbd list, fix
  project-local hook installation, and improve setup git root resolution

## 0.1.7

### Patch Changes

- Inherit spec_path from parent beads, automatic gh CLI setup via SessionStart hook, and
  various bug fixes

## 0.1.6

### Patch Changes

- afc01dd: Agent orientation system, DocCache with shortcuts, and documentation
  improvements.
- cc830b5: Spec linking feature with `--spec` options for create/list commands,
  configurable doc cache with auto-sync, and various bug fixes.

## 0.1.5

### Patch Changes

- afc01dd: Agent orientation system, DocCache with shortcuts, and documentation
  improvements.

## 0.1.4

### Patch Changes

- Fix subdirectory support, enforce atomic writes for data integrity, and add
  relationship types documentation.

## 0.1.3

### Patch Changes

- Fix build to ensure clean version numbers by syncing documentation files before
  release.

## 0.1.2

### Patch Changes

- Bug fixes, CLI improvements, and documentation updates including redesigned
  status/stats/doctor commands, improved error handling with proper exit codes, and test
  infrastructure improvements.

## 0.1.1

### Patch Changes

- Fix flaky performance test and clarify publishing documentation
