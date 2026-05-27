# get-tbd

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
