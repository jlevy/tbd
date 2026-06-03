# Implementation Map: `--surfaces` Setup Selector (PR #156)

Last updated: 2026-06-03

Maintenance: companion to the design spec
[`plan-2026-05-24-multi-agent-skills-hooks-setup.md`](../../specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md)
(epic `tbd-g9x7`). When the design changes, update the spec first, then this map.

## Overview

[PR #156](https://github.com/jlevy/tbd/pull/156) began as a design-lock (spec only) and
now carries the **full implementation** on branch `feat/setup-surfaces-selector`
(3 commits, 10 files, +324/−236; typecheck + eslint clean, 1146/1146 vitest pass).

This document is the **as-built** map of that work, down to file and function level, with
status badges. It was originally written against the locked design and is now reconciled
to the landed code — including how the three open decisions it flagged were resolved
(see "Resolved Decisions" at the end). Where the implementation chose a simpler shape
than the spec's literal wording, that is noted inline.

**Scope**: the four beads the PR lands — `tbd-zd4h` (`--surfaces` + registry),
`tbd-orup` (Codex script decoupling), `tbd-shsb` (version-pin audit), `tbd-l2ym`
(diagnostics labels) — plus tests/goldens. The path-model refactor (`tbd-0fhy`) landed
earlier.

All paths are under `packages/tbd/` unless noted.

## Badge Legend

| Badge | Meaning |
| --- | --- |
| ✅ | Landed in PR #156 (as-built) |
| 🆕 | New symbol introduced by the PR |
| ♻️ | Existing structure replaced / refactored |
| 🗑️ | Removed by the PR |
| 🧪 | Test or golden added / updated |
| 💡 | Implementation chose a different (simpler) shape than the spec's literal wording |

## Workstream A — `tbd-zd4h`: `--surfaces` selector + surface registry ✅

The fixed `{ claude, codex }` targeting and the two `setup*IfDetected` methods are
replaced by an ID-list + dispatch model the run loop iterates. Default = all surfaces;
`--surfaces=<comma-list>` (with `all` alias) restricts; an unknown ID is a hard error.
`agents-md` is split out of the bundled `codex` surface.

### `src/cli/commands/setup.ts`

| Badge | Symbol / Location | As-built |
| --- | --- | --- |
| 🆕💡 | `SETUP_SURFACE_IDS` (const tuple) + `SurfaceId` type + `SURFACE_DISPLAY_NAME` record, `setup.ts:~1748` | The spec said "`Surface[]` registry of `{ id, displayName, install }`"; #156 implemented the simpler **ID tuple + display-name record + `installSurface` switch**. Adding an agent = one ID + one `switch` case. Equivalent extensibility, less ceremony. |
| 🗑️ | `SurfaceMode = 'on' \| 'off' \| 'auto'` type | Removed — detection gating is gone; default installs all. |
| 🆕 | `resolveSurfaces(): Set<SurfaceId>` | Parses `--surfaces`; `undefined` → all; `all` alias expands; unknown ID throws `CLIError('Unknown surface …')`. (My map predicted `parseSurfaces`; shipped name is `resolveSurfaces`.) |
| 🆕 | `installSurface(id, cwd): Promise<AutoSetupResult>` | `switch` dispatch over the four IDs. |
| 🆕 | `installPortableSurface` / `installClaudeSurface` / `installAgentsMdSurface` / `installCodexSurface` | One installer per surface; each captures errors into `result.error` (CLIError format-guard still re-thrown as a hard stop). |
| ♻️ | `resolveTargeting()` (was `setup.ts:1993-2013`) | Replaced by `resolveSurfaces()`. |
| ♻️ | `setupClaudeIfDetected()` (was `:2015-2075`) | Became `installClaudeSurface()`; `~/.claude` / `CLAUDE_*` detection gate dropped. |
| ♻️ | `setupCodexIfDetected()` (was `:2077-2128`) | Split into `installAgentsMdSurface()` + `installCodexSurface()`; `CODEX_*` detection gate dropped. |
| ♻️ | `SetupAutoHandler.run()` loop (`:1852-1926`) | Now `for (const id of SETUP_SURFACE_IDS) if (selected.has(id)) results.push(await installSurface(...))`. Reporting changed from "Not detected (skipped)" to "Skipped (not in --surfaces)" + a `failed` section. |
| 🗑️ | Flags `--all` / `--claude` / `--codex` / `--skip-claude` / `--skip-codex` (`:2140-2144`) | All five removed. |
| 🆕 | Flag `--surfaces <list>` | `portable, agents-md, claude, codex (or "all"). Default: all`. |
| ✅ | Setup help/epilog (`:2161-2184`) | Rewritten: per-agent flag lines replaced with the `--surfaces` line. |
| 🗑️ | `GLOBAL_CLAUDE_DIR` import | Dropped (detection removed). |

### `src/cli/commands/setup.ts` — `SetupCodexHandler`

| Badge | Symbol | As-built |
| --- | --- | --- |
| 🆕 | `runAgentsMdOnly()` | Installs only the `AGENTS.md` managed block. |
| 🆕 | `runCodexHooksOnly()` | Installs only `.codex/hooks.json` + scripts. Lets the two surfaces install independently. |

### `src/lib/integration-paths.ts`

| Badge | Symbol | As-built |
| --- | --- | --- |
| ✅ | `getAgentSkillPaths()`, `getClaudePaths()`, `getCodexPaths()`, `AGENTS_SKILL_REL`, `CLAUDE_SKILL_REL`, `AGENTS_MD_REL` | Reused unchanged by the four installers. |

## Workstream B — `tbd-orup`: Codex / shared-script decoupling ✅

Resolved by **deletion**, not wiring. The dead `scripts/agent/` constants were removed;
tbd keeps per-agent script copies (`.claude/scripts/`, `.codex/`). The load-bearing
requirement — Codex hooks never reference `.claude/` — holds, and
`cli-agent-skill-patterns §6.6` treats per-agent copies as a valid alternative.

### `src/lib/integration-paths.ts`

| Badge | Symbol | As-built |
| --- | --- | --- |
| 🗑️ | `AGENT_SCRIPTS_DIR_REL`, `SHARED_SESSION_SCRIPT_REL`, `SHARED_CLOSING_REMINDER_REL`, `SHARED_GH_CLI_SCRIPT_REL`, `getSharedScriptPaths()` | Removed (were exported but referenced nowhere); replaced by an explanatory comment block. |
| ✅ | `getCodexHooksConfig()` (`setup.ts:420-447`) | Unchanged — already writes Codex-local paths, never `.claude/`. |

## Workstream C — `tbd-shsb`: install-hint pinning audit ✅

Resolved as a **no-op with a spec correction**. An audit confirmed every remaining
`@latest` usage is either a forward-compatibility "requires a newer tbd" error
(`doctor.ts:451`, `doctor.ts:1096`, `setup.ts:194`, `tbd-format.ts:394`) or the
first-install bootstrap one-liner (`output.ts:132`) — all of which *should* fetch the
newest release. The session script is already pinned via `get-tbd@${VERSION}`. My map's
analysis (#159) flagged exactly these as forward-compat exceptions; #156 confirmed it.

| Badge | Location | As-built |
| --- | --- | --- |
| ✅ | `output.ts:132`, `setup.ts:194`, `doctor.ts:451/1096`, `tbd-format.ts:394` | No change — intentionally remain `@latest`. |
| ✅ | `setup.ts:267,272` (`TBD_SESSION_SCRIPT`) | Already version-pinned. |
| 💡 | `PINNED_NPM_VERSION` | The spec names this constant; the codebase exports `VERSION` (`version.ts:40`) and #156 did not rename. Spec wording vs. code symbol mismatch remains — cosmetic, not load-bearing. |

## Workstream D — `tbd-l2ym`: diagnostics surface labels ✅

The `AGENTS.md` surface is now read by many agents, not just Codex, so the diagnostic
label drops the `Codex` prefix.

| Badge | File:Location | Symbol | As-built |
| --- | --- | --- | --- |
| ✅ | `doctor.ts:910-928` | `checkCodexAgents()` | Label `Codex AGENTS.md` → `AGENTS.md` (3 occurrences). |
| ✅ | `status.ts:344` | `StatusHandler` integrations | Same relabel. |
| ✅ | `doctor.ts:859-905` | `checkPortableSkill` / `checkClaudeSkill` / `checkCodexHooks` | Unchanged — already per-surface. |

## Workstream E — Tests & Goldens ✅🧪

| Badge | File | As-built |
| --- | --- | --- |
| 🧪 | `tests/setup-flows.test.ts` | `agent-targeting flags` block replaced by `--surfaces selector`: default installs all four; `--surfaces=codex` only Codex; `--surfaces=agents-md,portable` only those two; unknown ID errors. |
| 🧪 | `tests/cli-setup-commands.tryscript.md` | Help golden re-written for `--surfaces` (option column re-wrapped). |
| 🧪 | `tests/cli-beads.tryscript.md` | `--from-beads` grep updated for the re-wrapped option column. |
| 🧪 | `tests/cli-orientation-golden.tryscript.md` | `Codex AGENTS.md` → `AGENTS.md` in INTEGRATIONS output. |
| 🧪 | `tests/gitignore-policy.test.ts` | Dropped the never-written `scripts/agent/tbd-session.sh` from the must-be-tracked list. |

## Surface Registry (as built)

| ID | Writes | Installer |
| --- | --- | --- |
| `portable` | `.agents/skills/tbd/SKILL.md` | `installPortableSurface` |
| `agents-md` | `AGENTS.md` managed block | `installAgentsMdSurface` → `runAgentsMdOnly` |
| `claude` | `.claude/skills/tbd/SKILL.md` + `.claude/settings.json` hooks | `installClaudeSurface` |
| `codex` | `.codex/hooks.json` + `.codex/` scripts | `installCodexSurface` → `runCodexHooksOnly` |

`skills/tbd/SKILL.md` (repo-root distribution copy) is **not** a `--surfaces` value — it
is a publication artifact guarded by the `integration-files.test.ts` drift test.

## Resolved Decisions

The three questions this map raised against the locked design were all settled by
PR #156's implementation:

1. **`tbd-orup` shared scripts** → **Deleted** the dead `scripts/agent/` constants; kept
   per-agent copies. Codex hooks never reference `.claude/`.
2. **`PINNED_NPM_VERSION` naming** → No constant added; code keeps `VERSION`. Spec
   wording is the only place the longer name appears (cosmetic).
3. **Forward-compat `@latest` hints** → Audited and **left as `@latest`** on purpose;
   only the self-reproducing session script is pinned. Matches this map's original call.

## References

- Spec: [`plan-2026-05-24-multi-agent-skills-hooks-setup.md`](../../specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md)
- PR #156 (implementation): https://github.com/jlevy/tbd/pull/156
- PR #159 (this map): https://github.com/jlevy/tbd/pull/159
- Beads: `tbd-zd4h`, `tbd-orup`, `tbd-shsb`, `tbd-l2ym` (epic `tbd-g9x7`)

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
