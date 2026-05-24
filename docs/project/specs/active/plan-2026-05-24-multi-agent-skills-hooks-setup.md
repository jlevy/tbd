---
title: Modernize multi-agent skills and hooks setup
description: Plan for making tbd setup align with current Agent Skills paths, Codex hooks, and repository integration best practices
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: Modernize multi-agent skills and hooks setup

**Date:** 2026-05-24 (last updated 2026-05-24)

**Author:** Joshua Levy (github.com/jlevy) with LLM assistance

**Status:** In Review

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

## Design

### Agent Integration Surfaces

Use four distinct surfaces with clear ownership:

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

Setup should also expose an explicit targeting model:

- `--auto` keeps the current default behavior: detect available surfaces and refresh
  project-local integrations.
- Future explicit flags should let users request or suppress individual surfaces, for
  example `--claude`, `--codex`, `--cursor`, `--agents-md`, `--all`, or matching
  `--no-*` flags.
- The design must define how explicit flags interact with config defaults and existing
  files before implementation.

### Codex Hook Parity

Claude Code currently gets:

- `SessionStart`: run `tbd prime`
- `PreCompact`: run `tbd prime --brief`
- `SessionStart`: ensure `gh` is available when `settings.use_gh_cli` is true
- `PostToolUse`: remind about `tbd sync` after `git push`

Codex should get the best available equivalent using official Codex configuration:

- Add project-local Codex hook/config support only after confirming the exact current
  file format and event names from the official Codex hooks docs.
- Prefer shared scripts over duplicated script bodies:
  - shared bootstrap script for `tbd prime`
  - shared `ensure-gh-cli.sh`
  - shared close-protocol reminder script
- If a Claude-specific script path is required by Claude Code, use a small wrapper or a
  mirrored copy rather than making `.claude/scripts/` the canonical script home.
- Codex hook entries must not reference `.claude/scripts/`; that creates an undocumented
  cross-agent coupling and makes Codex setup depend on Claude setup.
- If Codex lacks a direct equivalent for a Claude event, make that limitation explicit
  in `AGENTS.md`, `SKILL.md`, `status`, and `doctor` instead of inventing unsupported
  behavior.

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

- `tbd-g9x7` - Modernize multi-agent skills and hooks setup

Children:

| Bead | Priority | Status | Scope |
| --- | --- | --- | --- |
| `tbd-t5q1` | P1 | closed | Write implementation spec for multi-agent skills setup |
| `tbd-0fhy` | P1 | open | Refactor agent integration path model |
| `tbd-1h9x` | P1 | open | Adopt `.agents/skills` as primary Agent Skills install path |
| `tbd-qgpl` | P1 | open | Add `skills/tbd` distribution source |
| `tbd-mjxt` | P1 | open | Define AGENTS.md scope and marker policy |
| `tbd-orup` | P1 | open | Add Codex startup and gh CLI setup parity |
| `tbd-shsb` | P1 | open | Document pinned CLI runner fallback patterns |
| `tbd-zd4h` | P2 | open | Add agent-targeted setup flag design |
| `tbd-l2ym` | P1 | open | Update setup check remove status and doctor |
| `tbd-udka` | P1 | open | Align CLI agent skill guidelines with implementation |
| `tbd-0q8h` | P1 | open | Audit gitignore policy for agent integration files |
| `tbd-bz0h` | P1 | open | Add tests for multi-agent skills and hooks setup |
| `tbd-m6f3` | P1 | open | Self-apply tbd setup to this repository |
| `tbd-wha7` | P2 | open | Validate ecosystem compatibility and release metadata |

Dependency outline:

- `tbd-0fhy` depends on `tbd-t5q1`.
- `tbd-1h9x` depends on `tbd-0fhy`.
- `tbd-qgpl` depends on `tbd-0fhy` and `tbd-1h9x`.
- `tbd-orup` depends on `tbd-t5q1`.
- `tbd-mjxt` depends on `tbd-t5q1`.
- `tbd-shsb` depends on `tbd-t5q1`.
- `tbd-zd4h` depends on `tbd-t5q1`.
- `tbd-l2ym` depends on `tbd-1h9x`, `tbd-orup`, and `tbd-mjxt`.
- `tbd-udka` depends on `tbd-1h9x`, `tbd-orup`, `tbd-shsb`, and `tbd-mjxt`.
- `tbd-0q8h` depends on `tbd-0fhy`.
- `tbd-bz0h` depends on `tbd-1h9x`, `tbd-orup`, `tbd-l2ym`, `tbd-shsb`, `tbd-zd4h`, and
  `tbd-mjxt`.
- `tbd-m6f3` depends on `tbd-bz0h`, `tbd-udka`, and `tbd-0q8h`.
- `tbd-wha7` depends on `tbd-m6f3` and `tbd-bz0h`.

## Testing Strategy

- Unit tests for path constants and helper APIs.
- Setup-flow tests for fresh repositories, already initialized repositories, and
  repeated idempotent runs.
- Hook tests for Claude and Codex surfaces, including gh CLI hook enable/disable.
- Integration-file tests validating `SKILL.md` frontmatter and generated payload parity.
- Doctor/status tests for missing, partial, and fully installed integrations.
- Tryscript/golden output updates for user-facing setup/status/doctor text.
- Formatting, linting, typechecking, and full test suite before merge.

## Rollout Plan

- Ship as a backwards-compatible setup enhancement.
- On existing repositories, `tbd setup --auto` should add `.agents/skills/tbd/SKILL.md`
  without removing `.claude/skills/tbd/SKILL.md`.
- `tbd setup --remove` should remove tbd-managed integration artifacts while preserving
  user-owned content outside tbd markers.
- Release notes should call out the new portable Agent Skills path and the continued
  Claude mirror.

## Open Questions

- What exact Codex hook file and event mapping should tbd use for `tbd prime`, gh CLI
  setup, and close-protocol reminders?
- Should `.agents/skills/tbd/SKILL.md` be installed unconditionally for every
  initialized repo, even if no skill-aware agent is detected?
- Should `skills/tbd/SKILL.md` be committed as a generated artifact with a drift test,
  or manually maintained as a concise source file?
- Should `tbd setup --remove` remove `.agents/skills/tbd/SKILL.md` by default, or only
  remove agent-specific mirrors and hooks?

## References

- [Agent Skills specification](https://agentskills.io/specification)
- [Agent Skills implementor guide](https://agentskills.io/client-implementation/adding-skills-support)
- [Codex Agent Skills docs](https://developers.openai.com/codex/skills)
- [Codex hooks docs](https://developers.openai.com/codex/hooks)
- [Claude Code skills docs](https://code.claude.com/docs/en/skills)
- [Gemini CLI Agent Skills docs](https://geminicli.com/docs/cli/skills/)
- [GSD skills docs](https://getshitdone.help/skills-extensions-agents/)
- [Vercel supported agents](https://www.mintlify.com/vercel-labs/skills/guides/supported-agents)
- [gstack](https://github.com/garrytan/gstack)
- [superpowers](https://github.com/obra/superpowers)
