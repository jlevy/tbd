# Implementation Map: `--surfaces` Setup Selector (PR #156)

Last updated: 2026-06-03

Maintenance: companion to the design spec
[`plan-2026-05-24-multi-agent-skills-hooks-setup.md`](../../specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md)
(epic `tbd-g9x7`). When the design changes, update the spec first, then this map.

## Overview

[PR #156](https://github.com/jlevy/tbd/pull/156) is a **design-lock** change: it edits
only the spec (+90 / −16, one file, no code). This document maps the *remaining*
implementation that the locked design implies, down to the file and function level, so
the work can be picked up TDD-first on branch `feat/setup-surfaces-selector`.

**Scope**: the four still-open beads the PR calls out — `tbd-zd4h` (`--surfaces`
registry), `tbd-orup` (shared-script / Codex decoupling), `tbd-shsb` (version-pin
hints), `tbd-l2ym` (diagnostics) — plus their tests/goldens. Out of scope: the already
landed path-model refactor (`tbd-0fhy`) and beads not gated by this PR.

All paths are under `packages/tbd/` unless noted.

## Badge Legend

| Badge | Meaning |
| --- | --- |
| 🆕 | Net-new file, function, or constant to create |
| ✏️ | Modify an existing function / lines in place |
| ♻️ | Replace / refactor an existing structure (delete-and-rewrite) |
| 🗑️ | Remove existing code (flag, branch, method) |
| ✅ | Already in place — reference only, no change |
| 🧪 | Test or golden to add / update |
| ❓ | Open decision or spec-vs-code discrepancy — resolve before coding |

## Workstream A — `tbd-zd4h`: `--surfaces` selector + surface registry

Replace the fixed `{ claude, codex }` targeting and the two bespoke
`setup*IfDetected` methods with a `Surface[]` registry the run loop iterates. Default =
all surfaces; `--surfaces=<comma-list>` (with `all` alias) restricts. `agents-md` splits
out of the bundled `codex` surface.

### `src/cli/commands/setup.ts` ✏️♻️🗑️

| Badge | Symbol / Location | Action |
| --- | --- | --- |
| 🆕 | `Surface` type + `SURFACE_REGISTRY: Surface[]` (new top-level) | Define `{ id, displayName, install(cwd, ctx) }`. Four entries: `portable`, `agents-md`, `claude`, `codex`. Adding an agent = one entry. |
| 🆕 | `parseSurfaces(value?: string): Set<SurfaceId>` | Parse comma-list, accept `all` alias, validate IDs against the registry, error on unknown IDs. Default (undefined) → all. |
| ♻️ | `resolveTargeting()` — `SetupAutoHandler`, `setup.ts:1993-2013` | Replace `{ claude, codex }` / `SurfaceMode` resolution with selected-`Set<SurfaceId>` logic. Drop the `'on'\|'off'\|'auto'` `SurfaceMode` type (`setup.ts:1740`) — there is no detection gating anymore; default writes all. |
| 🗑️ | `SurfaceMode` type — `setup.ts:1740` | Remove (no longer needed; install is unconditional unless restricted). |
| ♻️ | `setupClaudeIfDetected()` — `setup.ts:2015-2075` | Fold into a `claude` registry entry's `install()`. Drop the `~/.claude` / `CLAUDE_*` auto-detection gate. |
| ♻️ | `setupCodexIfDetected()` — `setup.ts:2077-2128` | Split into **two** registry entries: `agents-md` (AGENTS.md managed block) and `codex` (`.codex/hooks.json` + scripts). Drop the `AGENTS.md`/`CODEX_*` detection gate. |
| ✏️ | `SetupAutoHandler.run()` — `setup.ts:1852-1926` | Replace the hand-written portable-then-Claude-then-Codex sequence with: parse `--surfaces` → `for (const s of SURFACE_REGISTRY) if (selected.has(s.id)) await s.install(...)`. Keep legacy-cleanup + docs-sync prelude. |
| 🗑️ | Flags `--all`, `--claude`, `--codex`, `--skip-claude`, `--skip-codex` — `setup.ts:2140-2144` | Remove all five. |
| 🆕 | Flag `--surfaces <list>` — near `setup.ts:2140` | Add single Commander option; document `all` + the four IDs. |
| ✅ | Flags `--auto`/`--interactive`/`--from-beads`/`--prefix`/`--force`/`--no-gh-cli` — `setup.ts:2134-2139` | Unchanged (orthogonal). gh-CLI stays gated by `--no-gh-cli`/`settings.use_gh_cli`. |
| ✏️ | Setup help/epilog — `setup.ts:2161-2184` | Rewrite the targeting section: replace per-agent flag list with `--surfaces` usage + ID glossary + default-all note. |
| ✅ | `buildSkillPayload()` / `writeSkillFile()` / `SKILL_DO_NOT_EDIT_MARKER` — `setup.ts:108,124,137-149` | Reused unchanged by the `portable` + `claude` surface installers. |

### `src/lib/integration-paths.ts` ✅

| Badge | Symbol | Note |
| --- | --- | --- |
| ✅ | `getAgentSkillPaths()` `:202-211`; `AGENTS_SKILL_REL` `:87`; `CLAUDE_SKILL_REL` `:62`; `AGENTS_MD_REL` `:102`; `getCodexPaths()` `:218-227` | Already provide every path the four registry entries need. No change for this bead. |

## Workstream B — `tbd-orup`: shared scripts / Codex decoupling

Wire the dead `scripts/agent/` constants into both agents' hook configs, **or** delete
them deliberately. Either way, Codex hooks must never reference `.claude/`.

### `src/lib/integration-paths.ts` ❓✏️

| Badge | Symbol / Location | Action |
| --- | --- | --- |
| ❓ | `AGENT_SCRIPTS_DIR_REL` `:127`, `SHARED_SESSION_SCRIPT_REL` `:132`, `SHARED_CLOSING_REMINDER_REL` `:137`, `SHARED_GH_CLI_SCRIPT_REL` `:142`, `getSharedScriptPaths()` `:234-245` | **Currently exported but referenced by nothing.** Decision: (a) wire them in (below), or (b) `🗑️` delete them and keep per-agent copies. The spec leaves this open — pick one before coding. |
| ✅ | `CLAUDE_SCRIPTS_DIR_REL` `:51`, `CLAUDE_SETTINGS_REL` `:41`, `CODEX_HOOKS_REL` `:112` | Reference paths for the wiring. |

### `src/cli/commands/setup.ts` ✏️

| Badge | Symbol / Location | Action |
| --- | --- | --- |
| ✏️ | `getCodexHooksConfig()` — `setup.ts:420-447` | If wiring shared scripts: point Codex hook commands at `scripts/agent/*` (or `.codex/`-local), **never** `.claude/scripts/`. Verify no `.claude/` path leaks into `.codex/hooks.json`. |
| ✏️ | `installCodexHooks()` — call site `setup.ts:1015` | Ensure the scripts it writes/links live in the chosen neutral location. |
| ✏️ | Claude hook command generation (`TBD_SESSION_SCRIPT` template `setup.ts:267,272`; `.claude/settings.json` writer) | If scripts move out of `.claude/scripts/`, update tbd-owned Claude hook commands (or leave a wrapper) so existing Claude installs keep working. |

## Workstream C — `tbd-shsb`: pin install hints to running version

Switch agent-facing `@latest` hints to the running version. Spec names the constant
`PINNED_NPM_VERSION`; **the code has no such constant** — see ❓ below.

| Badge | File:Location | Symbol | Action |
| --- | --- | --- | --- |
| ❓ | `src/cli/lib/version.ts:40` | `VERSION` (no `PINNED_NPM_VERSION` exists) | The spec/PR reference `PINNED_NPM_VERSION`; the actual export is `VERSION` (from `getVersion()` `:20-35`). Decide: rename/alias `VERSION → PINNED_NPM_VERSION`, or treat the spec name as the existing `VERSION`. |
| ✏️ | `src/cli/lib/output.ts:132` | `createHelpEpilog()` `:125-141` | Change `get-tbd@latest` → `get-tbd@${VERSION}`. |
| ❓ | `src/cli/commands/setup.ts:194` | `assertNotNewerFormat()` `:188-197` | PR lists this as a hint to pin — **but it is the forward-compat "format is newer" upgrade error**, structurally identical to the `tbd-format.ts` exception that the spec says should *stay* `@latest`. Confirm intent before changing; likely it should remain `@latest`. |
| ✅ | `src/cli/commands/setup.ts:267,272` | `TBD_SESSION_SCRIPT` template | Already pinned via `get-tbd@${VERSION}`. No change. |
| ❓ | `src/cli/commands/doctor.ts:451,1096` | `checkConfig()` / `checkCommonDirLayout()` | Both `@latest` hints fire on `IncompatibleFormat` (on-disk format newer than client) — again the forward-compat case. Confirm whether these are "pin" targets or fall under the upgrade-error exception. |
| ✅ | `src/lib/tbd-format.ts:394` | `formatUpgradeMessage()` `:385-396` | The spec's **sole intentional `@latest` exception** — leave unchanged. |

## Workstream D — `tbd-l2ym`: diagnostics report the four surfaces

### `src/cli/commands/doctor.ts` ✏️

| Badge | Symbol / Location | Action |
| --- | --- | --- |
| ✅ | `checkPortableSkill()` `:859-873`, `checkClaudeSkill()` `:875-889`, `checkCodexAgents()` `:907-931`, `checkCodexHooks()` `:891-905` | Already cover the four surfaces. |
| ✏️ | INTEGRATIONS render — `DoctorHandler.run()` `:281-283` | Report by the canonical surface IDs (`portable`, `agents-md`, `claude`, `codex`) so doctor output matches `--surfaces` vocabulary. |
| ✏️ | `status` command (separate file) | Mirror the four-surface, ID-keyed reporting. |

## Workstream E — Tests & Goldens 🧪

| Badge | File | Action |
| --- | --- | --- |
| 🧪 | `tests/cli-setup-commands.tryscript.md` (`:34-50`) | Replace the `--all/--claude/--codex/--skip-*` assertions with `--surfaces` help text + ID list. |
| 🧪 | `tests/setup-flows.test.ts` | Add cases: default installs all four surfaces; `--surfaces=portable,agents-md` installs only those; unknown ID errors; `agents-md` installs without Codex hooks and vice versa; idempotent re-run dedupes hooks. |
| 🧪 | `tests/cli-setup.tryscript.md` | Refresh setup golden text for new flag/help shape. |
| 🧪 | `tests/cli-help-all.tryscript.md` | Refresh — `--surfaces` must appear; removed flags must not. |
| 🧪 | `tests/integration-files.test.ts` (`:60-79`) | Drift test for `skills/tbd/SKILL.md` ↔ `dist/docs/SKILL.md` — keep green (run `pnpm build` after any payload change). |
| 🧪 | `tests/common-dir-layout-doctor.test.ts`, `doctor-sync.test.ts` | Update doctor goldens to the ID-keyed surface reporting. |

## Surface Registry (target shape)

| ID | Writes | Owner |
| --- | --- | --- |
| `portable` | `.agents/skills/tbd/SKILL.md` | tbd generated |
| `agents-md` | `AGENTS.md` managed block (`<!-- BEGIN/END TBD INTEGRATION -->`) | hybrid |
| `claude` | `.claude/skills/tbd/SKILL.md` mirror + `.claude/settings.json` hooks | tbd generated |
| `codex` | `.codex/hooks.json` + `.codex/` lifecycle scripts | tbd generated |

`skills/tbd/SKILL.md` (repo-root distribution copy) is **not** a `--surfaces` value — it
is a publication artifact guarded by the drift test, never written into consumer repos.

## Open Decisions (resolve before coding) ❓

1. **`tbd-orup` shared scripts** — wire `scripts/agent/*` into both configs, or delete
   the dead constants and keep per-agent copies? (`integration-paths.ts:127-142`)
2. **`PINNED_NPM_VERSION` naming** — the spec/PR name a constant that does not exist;
   the live export is `VERSION` (`version.ts:40`). Rename/alias or treat as `VERSION`.
3. **Forward-compat `@latest` hints** — `setup.ts:194`, `doctor.ts:451`, `doctor.ts:1096`
   are all forward-compat upgrade errors, the same category the spec explicitly *exempts*
   in `tbd-format.ts`. Confirm whether they are pin targets or exceptions before editing.

## References

- Spec: [`plan-2026-05-24-multi-agent-skills-hooks-setup.md`](../../specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md)
- PR #156: https://github.com/jlevy/tbd/pull/156
- Beads: `tbd-zd4h`, `tbd-orup`, `tbd-shsb`, `tbd-l2ym` (epic `tbd-g9x7`)

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
