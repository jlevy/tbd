---
title: Modernize multi-agent skills and hooks setup
description: Plan for making tbd setup align with current Agent Skills paths, Codex hooks, and repository integration best practices
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Modernize multi-agent skills and hooks setup

**Date:** 2026-05-24 (last updated 2026-05-24)

**Author:** Joshua Levy (github.com/jlevy) with LLM assistance

**Status:** Ready to Implement (beads detailed under epic `tbd-g9x7`, 2026-05-25)

## Overview

tbd currently treats Agent Skills mostly as a Claude Code integration:
`tbd setup --auto` writes `.claude/skills/tbd/SKILL.md`, installs Claude hooks in
`.claude/settings.json`, and writes always-on instructions to `AGENTS.md` for Codex and
other AGENTS-compatible tools.

That model is now behind the ecosystem.
Codex, Gemini CLI, Cursor, GSD, Vercel’s `skills` installer, and the Agent Skills
implementor guidance all treat `.agents/skills/` as the portable project-local skills
directory. Claude Code still documents `.claude/skills/` as its native project path, so
tbd should keep that path as a compatibility mirror rather than making it canonical.

This plan updates tbd’s own setup behavior, diagnostics, guidelines, and repository
dogfooding so the product follows the best practices it recommends.

### Current Non-Conformance (the gap this plan closes)

tbd does not yet follow the guidance in this plan. As of this writing:

- This repository’s `AGENTS.md` tbd-managed block is ~246 lines (of ~281 total) — well
  over the `<80–150` line compact-bootstrap budget the updated guideline recommends
  (closed by `tbd-jrir`).
- `packages/tbd/src/lib/integration-paths.ts` defines only Claude surfaces
  (`CLAUDE_SKILL_REL = .claude/skills/tbd/SKILL.md`); there is no `.agents/skills/`,
  Codex, or shared-script constant (closed by `tbd-0fhy`, `tbd-1h9x`).
- There is no `.agents/`, no `.codex/`, and no `skills/tbd/SKILL.md` in the repo
  (closed by `tbd-1h9x`, `tbd-qgpl`, `tbd-orup`).
- Hook scripts live under `.claude/scripts/` (e.g. `TBD_SESSION_SCRIPT_REL`), which the
  updated guideline now advises against for multi-agent setups (closed by `tbd-orup`).

Until Phases 2–4 land, an agent reading tbd’s own integration files would see the
anti-pattern, not the recommended pattern. Closing that gap is the explicit dogfooding
deliverable of this work.

## Goals

- Install `.agents/skills/tbd/SKILL.md` as the canonical project-local tbd Agent Skill.
- Keep `.claude/skills/tbd/SKILL.md` synchronized as a Claude Code compatibility mirror.
- Keep `AGENTS.md` as an always-on repository orientation surface, not as a replacement
  for Agent Skills.
- Add or confirm Codex-compatible setup for `tbd prime`, GitHub CLI readiness, and close
  protocol reminders using Codex’s current hook/config surfaces.
- Add `skills/tbd/SKILL.md` as the repository distribution copy for skills.sh-style
  installers and direct browsing.
- Ensure generated integration files that should be committed are not gitignored.
- Update `tbd setup --check`, `tbd setup --remove`, `tbd setup --auto`, `tbd status`,
  `tbd doctor`, tests, and guidelines to describe the same integration model.
- Upgrade prior `tbd setup` installs item-by-item when users run a newer tbd, including
  old `.claude/skills`-only installs, old large `AGENTS.md` blocks, legacy tbd-owned
  hooks, and missing new portable skill surfaces.
- Document pinned CLI invocation fallbacks for tools that are not installed globally,
  including pprose-style `uvx --from package@version` patterns.
- Define explicit agent-targeting setup flags so users and agents can choose surfaces
  intentionally when auto-detection is insufficient.
- Dogfood the new setup in this repository after implementation.

## Non-Goals

- Do not remove existing Claude Code support.
- Do not write to global user directories such as `~/.claude/`, `~/.codex/`, or
  `~/.agents/` from `tbd setup --auto`.
- Do not replace `AGENTS.md`; it remains the right place for always-on repo policy.
- Do not split every tbd shortcut or guideline into its own skill.
  tbd remains a meta-skill backed by CLI-discoverable resources.
- Do not build a skills registry or make tbd depend on skills.sh infrastructure.
- Do not make Codex hooks call scripts that live under `.claude/`; shared behavior
  should live in shared agent paths or Codex-native paths.

## Background

Relevant research:

- [Agent Skills Standard Paths](../../research/current/research-agent-skills-standard-paths.md)
- [CLI as Agent Skill](../../research/current/research-cli-as-agent-skill.md)
- [Skills vs Meta-Skill Architecture](../../research/current/research-skills-vs-meta-skill-architecture.md)
- [Publish tbd as a Skill on skills.sh](plan-2026-02-08-tbd-on-skills-sh.md)

The 2026-05-24 research refresh confirmed:

- The Agent Skills spec defines the `SKILL.md` format and recommends progressive
  disclosure, but does not mandate a single filesystem location.
- The Agent Skills implementor guide recommends scanning native paths plus
  `.agents/skills/` for cross-client interoperability.
- Codex reads repo skills from `.agents/skills` from the current directory up to the
  repo root, plus user/admin/system scopes.
- Codex has a hooks configuration surface; this should be considered for parity with
  Claude Code’s current `SessionStart`, `PreCompact`, and `PostToolUse` tbd hooks.
- Gemini CLI documents `.agents/skills/` as an alias for workspace and user skills.
- GSD uses `~/.agents/skills/` and project `.agents/skills/` as its skill directories.
- Vercel’s supported-agent table lists Codex, Cursor, OpenCode, Cline, Amp, Gemini CLI,
  and GitHub Copilot among tools using `.agents/skills/` for project installs.

### Downstream pprose Lessons

A downstream audit of `practical-prose`/pprose found several patterns tbd should adopt
or document:

- **Pinned command fallback is stronger than global-install assumptions.** pprose emits
  a local-first invocation chain, then a pinned zero-install fallback:
  `uvx --from practical-prose@<install-time-version> pprose <command>`. tbd’s current
  guidance assumes npm-global install paths and should grow equivalent patterns for npm,
  uvx, pipx, and Go CLIs.
- **AGENTS.md is not Codex-only.** tbd’s implementation already treats it as Codex,
  Factory.ai, and Cursor-compatible, but the guideline still labels it too narrowly.
- **Codex hooks need their own path policy.** If tbd adds `.codex/hooks.json` or another
  Codex-native hook file, those hooks should reference shared or Codex-native scripts,
  not `.claude/scripts/tbd-session.sh`.
- **Agent-targeting flags should be explicit.** pprose exposes optional AGENTS.md
  patching; tbd should design a clearer flag taxonomy such as `--claude`, `--codex`,
  `--cursor`, `--agents-md`, and `--all`, while preserving safe `--auto` behavior.
- **Existing unmarked AGENTS.md needs a playbook.** Status/doctor should tell users what
  it means when `AGENTS.md` exists but lacks the tbd marker block, and setup should
  preserve user content outside markers.
- **The tbd AGENTS.md block should stay, but shrink.** Downstream context and current
  Codex/Cursor docs support a repo-root `AGENTS.md` bootstrap, but the block should not
  duplicate the full tbd skill or generated shortcut/guideline directories.

## Design

### Agent Integration Surfaces

Use five distinct surfaces with clear ownership:

| Surface | Purpose | Owner | Commit? |
| --- | --- | --- | --- |
| `AGENTS.md` | Always-on repo policy, tbd operating protocol, broad orientation | Hybrid: user plus tbd marked section | Yes |
| `.agents/skills/tbd/SKILL.md` | Canonical portable project Agent Skill | tbd generated | Yes |
| `.claude/skills/tbd/SKILL.md` | Claude Code compatibility mirror | tbd generated | Yes |
| `skills/tbd/SKILL.md` | Distribution/publication source for skills.sh-style installers | tbd source/validated generated file | Yes |
| `.codex/*` hook/config files | Codex lifecycle automation where officially supported | tbd generated or hybrid, depending on file | Yes if project-level |

Project-local setup remains the default.
Global installs are common in the broader ecosystem, but adding global writes would be a
separate product decision.

### Setup Behavior

`tbd setup --auto` should:

1. Sync bundled docs into `.tbd/docs/` as today.
2. Generate one spec-compliant `SKILL.md` payload.
3. Write the payload to `.agents/skills/tbd/SKILL.md` for all initialized projects.
4. Mirror the same payload to `.claude/skills/tbd/SKILL.md` when Claude Code is detected
   or when existing Claude integration files are present.
5. Continue updating the tbd-managed section of `AGENTS.md`.
6. Install lifecycle hooks for detected agents where the agent has a supported
   project-local hook surface.
7. Avoid duplicate hooks by filtering existing tbd hook entries before appending current
   entries.
8. Detect old generated integration artifacts and upgrade them in place, preserving
   user-owned content and reporting every changed surface.

Setup should also expose an explicit targeting model:

- `--auto` keeps the current default behavior: detect available surfaces and refresh
  project-local integrations.
- Future explicit flags should let users request or suppress individual surfaces, for
  example `--claude`, `--codex`, `--cursor`, `--agents-md`, `--all`, or matching
  `--no-*` flags.
- The design must define how explicit flags interact with config defaults and existing
  files before implementation.

### Existing Install Upgrade Model

Treat generated agent integrations like config migrations: explicit format detection,
small deterministic upgrades, and itemized user-facing output.

Use a separate `AGENT_INTEGRATION_FORMAT` constant for generated agent setup artifacts
rather than reusing the repository data layout format such as `tbd_format: f04`. The
migration discipline should match config format migrations, but the version should
advance only when generated agent surfaces change shape.

Recommended initial surfaces:

- `AGENTS.md` block format:
  - Keep the stable region markers for backwards-compatible replacement:
    `<!-- BEGIN TBD INTEGRATION -->` and `<!-- END TBD INTEGRATION -->`.
  - Add a metadata comment immediately inside the managed block, for example
    `<!-- tbd:integration-format=2; surface=agents-md -->`.
  - Treat old marked blocks without metadata as format 1 and replace the whole managed
    region with the compact format 2 bootstrap.
  - Preserve all content outside the managed region.
  - If `AGENTS.md` exists without markers, append a new format 2 managed block and
    report “AGENTS.md exists; added missing tbd block.”
- Generated skill files:
  - Include the same integration format in the “DO NOT EDIT” marker or generated header.
  - Regenerate old `.claude/skills/tbd/SKILL.md` files and add
    `.agents/skills/tbd/SKILL.md`.
  - Keep the Claude mirror unless the user explicitly disables Claude support.
- Hooks and scripts:
  - Detect tbd-owned hook entries by command/path/signature and remove or replace only
    those entries.
  - Leave unrelated user hooks untouched.
  - If a shared script path changes, either update tbd-owned hook commands or leave a
    wrapper so existing Claude hooks do not break.
  - New Codex hook setup should not force a Claude hook migration unless an existing
    tbd-owned Claude hook points at a script that is being moved or renamed.

`tbd setup --auto` should print an itemized upgrade summary such as:

```text
Updated AGENTS.md tbd block: format 1 -> 2
Installed portable skill: .agents/skills/tbd/SKILL.md
Refreshed Claude skill mirror: .claude/skills/tbd/SKILL.md
Installed Codex hooks: .codex/hooks.json
Preserved user content outside managed markers
```

`setup --check`, `status`, and `doctor` should distinguish:

- current
- missing
- legacy/upgradable
- user-owned/unmarked
- conflict or malformed managed block
- disabled by config or explicit flags

`setup --remove` should remove both current and legacy tbd-owned artifacts and markers
while preserving user-owned content outside managed regions.

### Codex Hook Parity

Claude Code currently gets:

- `SessionStart`: run `tbd prime`
- `PreCompact`: run `tbd prime --brief`
- `SessionStart`: ensure `gh` is available when `settings.use_gh_cli` is true
- `PostToolUse`: remind about `tbd sync` after `git push`

Codex's hook engine (confirmed against the official Codex hooks docs, May 2026) uses the
**same event schema as Claude Code**: `SessionStart`, `PreCompact`/`PostCompact`,
`PreToolUse`/`PostToolUse`, `UserPromptSubmit`, `Stop`, and `SubagentStart`/`SubagentStop`,
loaded from `hooks.json` or an inline `[hooks]` table in `config.toml`. Only command
handlers run today. This means tbd's four Claude hooks map almost 1:1, so the realistic
target is near-full parity, not graceful degradation:

| Claude hook | Codex equivalent |
| --- | --- |
| `SessionStart` → `tbd prime` | `SessionStart` |
| `PreCompact` → `tbd prime --brief` | `PreCompact` |
| `SessionStart` → ensure `gh` (when `use_gh_cli`) | `SessionStart` |
| `PostToolUse` → `tbd sync` reminder after `git push` | `PostToolUse` (command matcher) |

- Prefer **one shared script referenced by two thin per-agent configs** over duplicated
  script bodies:
  - shared bootstrap script for `tbd prime`
  - shared `ensure-gh-cli.sh`
  - shared close-protocol reminder script
- Relocate these shared scripts out of `.claude/scripts/` into a neutral location (e.g.
  `scripts/agent/`) so neither agent's config owns them. Update tbd-owned Claude hook
  commands (or leave a wrapper) so existing Claude installs keep working through the move.
- Codex hook entries must not reference `.claude/scripts/`; that creates an undocumented
  cross-agent coupling and makes Codex setup depend on Claude setup.
- The `PostToolUse` `git push` reminder relies on a command matcher; confirm Codex's
  matcher semantics cover the shell-command case. If any single Claude event genuinely
  lacks a Codex equivalent, make that limitation explicit in `AGENTS.md`, `SKILL.md`,
  `status`, and `doctor` instead of inventing unsupported behavior.

### CLI Invocation Pinning

Generated skill text should prefer a local command when available, then a pinned
fallback appropriate to the package manager:

1. `mycli <command>` when already on `PATH`.
2. A pinned zero-install fallback such as:
   - `npx --yes my-package@<version> mycli <command>` for npm packages.
   - `uvx --from my-package@<version> mycli <command>` for Python packages distributed
     through uv-compatible indexes.
   - `pipx run my-package==<version> mycli <command>` when pipx is the intended runner.
   - `go run module/path@<version> <args>` for Go CLIs.
3. If neither local nor pinned fallback works, stop and tell the user what install step
   is required.

Never recommend an unpinned network runner from generated agent instructions unless the
user explicitly opts into that behavior.

### AGENTS.md Marker and Scope Policy

`AGENTS.md` guidance should cover:

- Repo-root `AGENTS.md` as the primary project instruction surface.
- Global Codex/user instruction files as an advanced/manual setup surface, not something
  `tbd setup --auto` writes by default.
- `<!-- BEGIN TBD INTEGRATION -->` / `<!-- END TBD INTEGRATION -->` as the authoritative
  managed-region contract.
- How setup behaves when `AGENTS.md` exists without markers: preserve the file and
  append the tbd block, or report the state clearly in check/doctor output.
- A generated-block size budget for AGENTS-compatible tools.
  Claude’s SKILL.md line and character budgets should not be copied uncritically to
  AGENTS.md.
- A block format marker so setup can detect legacy generated content and upgrade it
  without relying on brittle text comparisons.

For tbd itself, the recommended end state is to keep `<!-- BEGIN TBD INTEGRATION -->`
but make the block a compact bootstrap:

- identify tbd as the issue/workflow/guideline tool for the repo;
- tell agents to run `tbd prime` for current state;
- tell agents to use `tbd skill`, `tbd shortcut --list`, and `tbd guidelines --list` for
  progressive disclosure;
- keep detailed command directories in the skill and CLI output, not in `AGENTS.md`.

### Path Constants and Diagnostics

Move path knowledge into `packages/tbd/src/lib/integration-paths.ts` so setup, status,
doctor, and tests agree on:

- `.agents/skills/tbd/SKILL.md`
- `.claude/skills/tbd/SKILL.md`
- `AGENTS.md`
- Codex project hook/config paths
- shared agent script paths
- `skills/tbd/SKILL.md`

Diagnostics should report:

- Portable Agent Skill installed/missing/outdated.
- Claude Code skill mirror installed/missing/outdated.
- `AGENTS.md` tbd section installed/missing.
- Claude hooks installed/missing.
- Codex hooks or documented fallback installed/missing.
- gh CLI auto-setup enabled/disabled and installed/missing.

### Gitignore Policy

Do not ignore project integration files that should travel with the repository:

- `.agents/skills/tbd/SKILL.md`
- `.claude/skills/tbd/SKILL.md`
- `AGENTS.md`
- Codex hook/config files that are part of project setup
- shared agent scripts
- `skills/tbd/SKILL.md`

Only ignore local caches, temporary files, backups, local state, and regenerated
documentation caches such as `.tbd/docs/`.

### Guidelines

Update `packages/tbd/docs/guidelines/cli-agent-skill-patterns.md` to match the product:

- Describe `AGENTS.md` as always-on repo instructions.
- Describe `SKILL.md` under `.agents/skills/` as the portable capability mechanism.
- Describe `.claude/skills/` as the Claude Code native mirror.
- Split Cursor guidance into rules for always-on policy and skills for procedural
  dynamic workflows.
- Document Codex as supporting both `AGENTS.md` and repo-local `.agents/skills/`.
- Document copy-over-symlink as the reliable default for project-local generated files.

## Implementation Plan

### Phase 1: Plan and Research

- [x] Create epic `tbd-g9x7` and child beads.
- [x] Refresh current Agent Skills path research.
- [x] Create this plan spec.
- [x] Link the epic and all children to this spec.
- [x] Update the PR description with this plan.
- [x] Incorporate downstream pprose audit lessons into the plan and bead map.

### Phase 2: Setup and Integration Model

- [ ] Refactor integration path constants.
- [ ] Add canonical `.agents/skills/tbd/SKILL.md` setup.
- [ ] Keep `.claude/skills/tbd/SKILL.md` as a mirror.
- [ ] Add `skills/tbd/SKILL.md` distribution source.
- [ ] Add Codex hook/config setup or an explicit documented fallback based on official
  Codex hook support.
- [ ] Add or document explicit agent-targeting setup flags.
- [ ] Add pinned CLI invocation fallback guidance to generated skill/guideline patterns.
- [ ] Define AGENTS.md marker, scope, and unmarked-file behavior.
- [ ] Shrink the tbd-managed `AGENTS.md` block to a compact bootstrap while keeping the
  marker contract.
- [ ] Add agent integration format detection and upgrades for existing `tbd setup`
  installs.
- [ ] Audit gitignore behavior for all generated and checked-in integration files.

### Phase 3: Diagnostics, Guidelines, and Tests

- [ ] Update `setup --check`, `setup --remove`, and setup reporting.
- [ ] Update `status` and `doctor` diagnostics.
- [ ] Update CLI agent skill guidelines.
- [ ] Add setup, hook, doctor, status, integration-file, and tryscript coverage.
- [ ] Validate no duplicate hooks are produced by repeated setup runs.

### Phase 4: Dogfood and Validate

- [ ] Build the local CLI.
- [ ] Run local `tbd setup --auto` in this repository.
- [ ] Commit the repository’s refreshed agent integration files intentionally.
- [ ] Run quality gates.
- [ ] Validate the distribution skill with available skills tooling.
- [ ] Update or close linked beads as implementation lands.

## Bead Map

Epic:

- `tbd-g9x7` — Modernize multi-agent skills and hooks setup

Children (descriptions enriched to file/function detail 2026-05-25; full acceptance
criteria live in each bead):

| Bead | Priority | Status | Scope |
| --- | --- | --- | --- |
| `tbd-t5q1` | P1 | closed | Write implementation spec for multi-agent skills setup |
| `tbd-0fhy` | P1 | open | Refactor agent integration path model (`integration-paths.ts`) |
| `tbd-1h9x` | P1 | open | Adopt `.agents/skills` as primary skill path with Claude mirror |
| `tbd-qgpl` | P1 | open | Add `skills/tbd` distribution source and drift test |
| `tbd-mjxt` | P1 | open | Define AGENTS.md scope, marker and format policy |
| `tbd-jrir` | P1 | open | Shrink generated AGENTS.md block to compact bootstrap |
| `tbd-orup` | P1 | open | Add Codex hook and gh CLI parity via shared scripts |
| `tbd-shsb` | P1 | open | Document and emit pinned CLI runner fallbacks |
| `tbd-zd4h` | P2 | open | Add agent-targeted setup flags |
| `tbd-fcam` | P1 | open | Existing-install upgrade, migration and format guard |
| `tbd-0q8h` | P1 | open | Audit gitignore policy for agent integration files |
| `tbd-l2ym` | P1 | open | Update setup check/remove, status and doctor diagnostics |
| `tbd-udka` | P1 | open | Align CLI agent skill guidelines with implementation |
| `tbd-bz0h` | P1 | open | Add tests for multi-agent skills and hooks setup |
| `tbd-m6f3` | P1 | open | Self-apply tbd setup to this repository |
| `tbd-wha7` | P2 | open | Validate ecosystem compatibility and release metadata |

Dependency outline (blocker edges; `tbd-0fhy` is the foundational unblocked task):

- `tbd-0fhy` depends on `tbd-t5q1`.
- `tbd-1h9x` depends on `tbd-0fhy`.
- `tbd-qgpl` depends on `tbd-0fhy` and `tbd-1h9x`.
- `tbd-orup` depends on `tbd-t5q1`.
- `tbd-mjxt` depends on `tbd-t5q1`.
- `tbd-jrir` depends on `tbd-mjxt` and `tbd-0fhy`.
- `tbd-shsb` depends on `tbd-t5q1`.
- `tbd-zd4h` depends on `tbd-t5q1`.
- `tbd-fcam` depends on `tbd-mjxt`, `tbd-1h9x`, and `tbd-orup`.
- `tbd-l2ym` depends on `tbd-1h9x`, `tbd-orup`, `tbd-mjxt`, `tbd-jrir`, and `tbd-fcam`.
- `tbd-udka` depends on `tbd-1h9x`, `tbd-orup`, `tbd-shsb`, `tbd-mjxt`, and `tbd-jrir`.
- `tbd-0q8h` depends on `tbd-0fhy`.
- `tbd-bz0h` depends on `tbd-1h9x`, `tbd-orup`, `tbd-l2ym`, `tbd-shsb`, `tbd-zd4h`,
  `tbd-mjxt`, `tbd-jrir`, and `tbd-fcam`.
- `tbd-m6f3` depends on `tbd-bz0h`, `tbd-udka`, `tbd-0q8h`, and `tbd-jrir`.
- `tbd-wha7` depends on `tbd-m6f3` and `tbd-bz0h`.

## Testing Strategy

- Unit tests for path constants and helper APIs.
- Setup-flow tests for fresh repositories, already initialized repositories, and
  repeated idempotent runs.
- Upgrade tests for old `.claude/skills`-only installs, old unversioned/full `AGENTS.md`
  tbd blocks, old tbd-owned hook entries, and partial installs.
- Hook tests for Claude and Codex surfaces, including gh CLI hook enable/disable.
- Integration-file tests validating `SKILL.md` frontmatter and generated payload parity.
- Doctor/status tests for missing, partial, and fully installed integrations.
- Tryscript/golden output updates for user-facing setup/status/doctor text.
- Formatting, linting, typechecking, and full test suite before merge.

## Rollout Plan

- Ship as a backwards-compatible setup enhancement.
- On existing repositories, `tbd setup --auto` should add `.agents/skills/tbd/SKILL.md`
  without removing `.claude/skills/tbd/SKILL.md`.
- Existing unversioned `AGENTS.md` tbd blocks should be treated as legacy generated
  format 1 and replaced with the compact versioned block.
- Existing tbd-owned hooks should be deduped and upgraded only when their command or
  script path changes; unrelated user hooks must be preserved.
- `tbd setup --remove` should remove tbd-managed integration artifacts while preserving
  user-owned content outside tbd markers.
- Release notes should call out the new portable Agent Skills path and the continued
  Claude mirror.

## Resolved Decisions

These were open questions; resolved 2026-05-25 so the beads are unambiguous:

- **Codex hook mapping** — use the same event schema as Claude (`SessionStart`,
  `PreCompact`, `PostToolUse`, etc.) via `.codex/hooks.json` or an inline `[hooks]` table
  in `.codex/config.toml`; command handlers only. See "Codex Hook Parity" above. (`tbd-ujh3`)
- **Install `.agents/skills/` unconditionally** for every initialized repo. It is
  project-local and harmless, and unconditional install is what makes the portable path
  actually portable. (`tbd-sp93`)
- **Commit `skills/tbd/SKILL.md`** as a generated artifact guarded by a drift test that
  regenerates and compares. Browsable on GitHub/skills.sh *and* protected from drift.
  (`tbd-fif7`)
- **`tbd setup --remove`** removes all tbd-owned artifacts, including
  `.agents/skills/tbd/SKILL.md` and `.codex/` files, while preserving user content outside
  managed markers. (`tbd-ymts`)
- **Integration format starts at `2`**: today's unversioned full `AGENTS.md` block is
  treated as legacy format 1, and the new compact block is format 2. (`tbd-slsp`, `tbd-y84j`)

## Self-Upgrade and Forward-Compatibility (Tier-2 behavior)

This integration tier (a CLI that self-installs evolving skills, hooks, and managed blocks)
follows the advanced pattern documented in `cli-agent-skill-patterns.md` §6.0/§6.6. Simpler
tools should remain pure skills invoked via a pinned `npx`/`uvx` and need none of this.

For tbd specifically:

- `tbd setup` / `tbd setup --auto` **self-upgrades existing installs in place, safely and
  idempotently**: it rewrites only tbd-owned regions (managed `AGENTS.md` block → compact
  format 2, generated skills, tbd-owned hooks, `.codex/` config), re-runs as a no-op when
  already current, and preserves all user content outside markers.
- **Forward-compatibility guard:** every generated artifact carries
  `AGENT_INTEGRATION_FORMAT`. When a running tbd encounters an artifact whose format is
  **newer** than it understands, it must **stop and recommend upgrading tbd**
  (`npm install -g get-tbd@latest`) instead of overwriting or downgrading it. This makes
  version pinning safe on teams: an older tbd fails loudly rather than clobbering a newer
  managed block. (`tbd-y84j`, surfaced by `tbd-ymts`)
- Version pinning in generated invocations serves both supply-chain hardening and
  cross-team/cross-agent behavioral consistency. (`tbd-1h2s`)

## References

- [Agent Skills specification](https://agentskills.io/specification)
- [Agent Skills implementor guide](https://agentskills.io/client-implementation/adding-skills-support)
- [Codex AGENTS.md docs](https://developers.openai.com/codex/guides/agents-md)
- [Codex Agent Skills docs](https://developers.openai.com/codex/skills)
- [Codex hooks docs](https://developers.openai.com/codex/hooks)
- [Claude Code skills docs](https://code.claude.com/docs/en/skills)
- [Cursor rules and AGENTS.md docs](https://docs.cursor.com/en/context/rules)
- [Gemini CLI Agent Skills docs](https://geminicli.com/docs/cli/skills/)
- [GSD skills docs](https://getshitdone.help/skills-extensions-agents/)
- [Vercel supported agents](https://www.mintlify.com/vercel-labs/skills/guides/supported-agents)
- [gstack](https://github.com/garrytan/gstack)
- [superpowers](https://github.com/obra/superpowers)
