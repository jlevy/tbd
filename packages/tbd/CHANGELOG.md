# get-tbd

## Unreleased (0.3.0)

The headline is **forkable docs**: every doc tbd serves (guidelines, shortcuts,
templates, and the new reference docs) can now be forked into your repo as visible,
git-tracked files, edited in place, and reconciled with upstream after upgrades.
The repository format bumps `f04` → `f06` in this release: `f05` adds the forkable-docs
layout, and `f06` adds a config upgrade history and redefines `tbd_version`. Both
migrations are metadata-only (they update `tbd_format` in `.tbd/config.yml` and refresh
generated metadata; fork artifacts appear only when you first fork something), so
upgrading is safe and revertible.

### Features

- **Agent CLI ergonomics (Phase 1)**: `close`, `reopen`, and `update` now accept
  multiple IDs and process them under one lock, printing a single summary line (or a
  structured `--json` `{ results, summary, sync }` object) plus a visible
  unsynced-changes hint.
  Validation is fail-closed, with `--ignore-missing` to downgrade unknown IDs to skips;
  single-ID behavior is unchanged.
  Free-text bodies (`--reason`/`--reason-file`, `-d`/`-f`, `--notes`/`--notes-file`)
  accept `-` to read stdin, so shell-sensitive text no longer needs careful quoting.
  `--quiet` is now fully silent on success (it also suppresses incidental worktree-heal
  and config-migration notices).
  The legacy no-op global `--no-sync` flag has been removed — writes always stage
  locally and `tbd sync` publishes.
- **Forkable docs** (`tbd docs fork` / `unfork` / `update` / `diff` / `status`): fork
  any managed doc into a visible fork dir (`docs/tbd/`, laid out by kind with a
  generated `README.md` index, tracked in git).
  Your copy shadows the hidden cache everywhere the doc is served; forking changes
  nothing about how docs work — it only makes them explicit and editable.
  - `tbd docs update` three-way merges upstream changes into your copies after an
    upgrade: `--merge` combines and writes conflict markers to resolve, `--keep-ours`
    keeps your version and advances the fork point; `--dry-run` previews and lists
    conflicts.
  - `tbd docs diff <name>` compares your copy against upstream (default), against its
    recorded base (`--base`, what you changed), or base against upstream (`--upstream`,
    incoming changes).
  - `tbd docs status` reports every fork’s state (`forked`, `customized`, `conflicted`,
    `missing`, plus `local` for your own files in the fork dir).
    States are recomputed from content hashes — no git operation can desynchronize
    tracking. Fork state lives in the committed `.tbd/doc-forks/` (a `forks.yml` manifest
    plus `base/` snapshots); the fork dir itself stays outside `.tbd/`.
- **The `tbd docs` surface is re-homed around managed docs**: bare `tbd docs` is now the
  status overview, and `tbd docs list` lists all docs across kinds with
  `[forked]`/`[customized]`/`[local]` markers.
  The CLI manual moved to `tbd docs show tbd-docs` (alias: `tbd docs manual`); the old
  `tbd docs --list` / `--all` / `--section` flags are retired in favor of
  `tbd docs show tbd-docs --sections` / `--section <name>`. `tbd docs show <name>` reads
  any doc by name, kind-agnostically.
  `tbd docs sync` refreshes the gitignored docs cache (`tbd sync --docs` remains as a
  deprecated alias).
- **docref + docmap formats, and a new `reference` doc kind**: every doc source is
  addressed by a **docref** — one URI-like grammar (`internal:…`, anchored local paths,
  URLs, `github:owner/repo@ref//path`) used for `docs_cache.files` values and
  fork-manifest `source` values alike — and every doc listing is one **docmap**
  (`docmap/0.1`) rendered as text or `--json`: `tbd docs list` / `tbd docs status`, the
  bare-`tbd docs` overview, and the per-kind `--list` (whose `--json` output changes
  from a flat array to a docmap).
  Both formats ship as docs of the new `reference` kind — read them with
  `tbd docs show docref-format` and `tbd docs show docmap-format` — alongside the manual
  (`tbd-docs`) and design doc (`tbd-design`), which are now managed docs too.
- **Fork drift is visible, never auto-fixed**: `tbd status` gains a `Docs:` line when
  forks exist (forked/customized counts, pending upstream updates, conflicts, missing
  files), and `tbd sync` prints a one-line notice when forked docs are stale,
  conflicted, or missing.
  Only the explicit `tbd docs update` ever modifies tracked files.
- **Config upgrade history** (format `f06`): `tbd_version` in `.tbd/config.yml` now
  records the version that last ran `tbd setup` (previously frozen at install time), and
  a new `tbd_upgrades` list records, oldest-first, the versions that have run setup in
  the repo. Both are informational (functional gating stays on `tbd_format`);
  `tbd config show` displays the history.
  The `f05 → f06` migration seeds the first entry from the prior `tbd_version`, and each
  setup appends the running version when it changes.

### Guidelines and content

These ship inside the package and are read by agents via `tbd docs show …`,
`tbd shortcut …`, and `tbd setup`:

- **New `suggest-upstream-improvements` shortcut**: the playbook for reviewing fork
  customizations (`tbd docs status --json`, `tbd docs diff <name> --base`), deciding
  what generalizes, contributing it upstream, and re-syncing with `tbd docs update` once
  merged.
- **New `docref-format` and `docmap-format` reference docs**: the specifications for the
  two formats above, forkable like any other doc.
- **Onboarding and agent surface updated for forkable docs**: `welcome-user` now makes
  the two-axis offer (scope: all standard guidelines or a stack subset; visibility:
  hidden cache or forked into `docs/tbd/`), and the agent skill routes fork, update, and
  missing-file requests to the new commands.

## 0.2.3

A drop-in patch on top of v0.2.2. **No on-disk format change** (`f04` stays `f04`), so
any machine already on v0.2.0 or later can upgrade without a migration.
The headline is hardened issue sync — a structured, field-level three-way merge of
issues that no longer loses child wiring or silently corrupts data — plus a new
`tbd doctor` check for an unwritable shared lock in agent sandboxes.

### Features

- **`tbd doctor` detects an unwritable shared data-sync lock**: every write command
  (`create`, `update`, `sync`) must take a repo-scoped lock under the Git common dir.
  When that path is not writable — common in agent sandboxes such as Codex worktrees,
  where the common dir lives outside the writable checkout — read-only commands still
  work but every write fails.
  Doctor now probes this up front and reports it as a hard error with sandbox-aware
  remediation, instead of letting writes fail later with a bare `EPERM`.
- **`tbd setup --surfaces` selector**: setup replaces its per-agent flags with a single
  `--surfaces=<list>` selector backed by a surface registry.
  Choose any comma-separated mix of `portable`, `agents-md`, `claude`, `codex`, or `all`
  (the default) to control exactly which integration surfaces are installed.
  **Note:** this removes the old `--all`, `--claude`, `--codex`, `--skip-claude`, and
  `--skip-codex` flags; scripts using them should move to `--surfaces`.

### Fixes

- **Structured three-way merge for issue sync (#155)**: sync now merges issues
  field-by-field from their git refs instead of doing a line-level text merge.
  This closes several ways a concurrent or push-retry sync could previously mangle data:
  - `child_order_hints` are union-merged (and null-safe), so concurrent edits no longer
    drop child-ordering wiring.
  - A missing issue is distinguished from a corrupt one during a ref merge.
  - Push-retry integrates the remote into the sync branch and re-runs the structured
    merge before retrying, rather than retrying against stale state.
  - A post-merge guard fails the sync loudly if any issue is left unparseable, instead
    of committing corrupt data.
- **Sync exits non-zero when a push failure isn’t parked in the outbox (#158)**: a
  failed push that could not be saved to the outbox for later retry now surfaces as a
  non-zero exit, so automation sees the failure instead of treating it as success.
- **Non-destructive rescue tolerates a dirty sync worktree (#158)**: recovery from
  unrelated histories no longer refuses when the sync worktree has uncommitted changes —
  the rescue captures that work on a backup branch — and unrelated-history divergence no
  longer suggests the unhelpful `tbd sync`.
- **Worktree auto-heal is surfaced at the point of use (#135)**: when a read or create
  re-creates a missing sync worktree, tbd now tells you it healed instead of repairing
  invisibly.
- **`tbd sync --status` shows the incoming remote commits**: the remote-commit lookup
  used an invalid `git log --limit` flag that threw and was swallowed, so the list was
  always empty; it now reports the commits the remote is ahead by.
- **Generated session script pins the published version**: the session script now pins
  `get-tbd@<published version>` instead of a dev/dirty `git describe` build string that
  isn’t installable from npm and churned generated files on every local build.

### Guidelines and content

These ship inside the package and are read by agents via `tbd guidelines …` and
`tbd setup`:

- **New `general-eng-agent-principles` guideline**: consolidates the core engineering
  standards — objectivity, communication, and the engineering process (understanding,
  verification, end-to-end ownership, scope discipline) — into one document, replacing
  the older `general-eng-assistant-rules`.
- **`cli-agent-skill-patterns` — attention-routing framing and an L0–L3 ladder**:
  expanded guidance on how coding agents discover and monitor CLI-backed skills, plus
  research on agent-skill and CLI packaging practices.
- **TypeScript guideline refresh**: clarifications across `typescript-rules`,
  `typescript-cli-tool-rules`, `typescript-code-coverage`, and the YAML/sorting rules.
- **`repren` agent skill** is now installed alongside the other surfaces for
  large-scale, multi-file renames.

### Security

Lockfile unchanged since v0.2.2; the resolved dependency tree is byte-identical, so no
new advisories. The only manifest change is a dev-tooling formatter swap (`flowmark` →
first-party `flowmark-rs`, pinned with a documented cool-off exception); it is not a
runtime dependency of the published package.

## 0.2.2

A drop-in patch on top of v0.2.1. **No on-disk format change** (`f04` stays `f04`), so
any machine already on v0.2.0 or later can upgrade without a migration.

### Fixes

- **`tbd setup --auto --dry-run` is now genuinely read-only.** The legacy-cleanup pass
  ran before any dry-run gating, so inspecting a setup with `--dry-run` could rewrite
  `.claude/settings.json` and delete legacy tbd scripts and hooks from disk — including
  hooks you had just installed.
  Dry runs now compute and report what *would* change ("Would clean up legacy …")
  without touching any files.
  Covered by two new regression tests.

### Guidelines and content

These ship inside the package and are read by agents via `tbd guidelines …`:

- **`supply-chain-hardening` — new “Safe-override patterns” section**: how to pull a
  fresh package version without weakening the global 14-day cool-off
  (verify-then-install flow with per-ecosystem verify commands, tarball-URL and git-ref
  installs that bypass npm version resolution, exact pins for uv/cargo/go), plus the
  dogfood footgun where an age gate silently resolves `@latest` to a *stale* version.
- **`cli-agent-skill-patterns` — L0–L3 integration ladder and project-vs-global scope**:
  the binary Tier-1/Tier-2 model is replaced by an L0–L3 ladder (pure prompt skill →
  pinned-delegation skill → self-installing skill → full platform), and a new §6.6.2
  codifies project-local vs user-global install mechanics (explicit
  `--project`/`--global`, `$HOME` refusal in project mode, pre-write target printing,
  cross-scope shadowing).

### Documentation

- Applied the common documentation guidelines to the docs shipped in this release (write
  “and” rather than "&"/"+" in prose, headings, and cross-references).

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

**Full commit history**:
[https://github.com/jlevy/tbd/compare/v0.2.0 … v0.2.1](https://github.com/jlevy/tbd/compare/v0.2.0...v0.2.1)

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
