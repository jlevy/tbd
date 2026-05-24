# Research Brief: Agent Skills Standard Paths

**Last Updated**: 2026-05-24

**Status**: Complete

**Related**:

- [CLI Agent Skill Patterns](../../../../packages/tbd/docs/guidelines/cli-agent-skill-patterns.md)
- [Modernize multi-agent skills and hooks setup](../../specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md)
- [Publish tbd as a Skill on skills.sh](../../specs/active/plan-2026-02-08-tbd-on-skills-sh.md)
- [Skills vs Meta-Skill Architecture](research-skills-vs-meta-skill-architecture.md)
- [CLI as Agent Skill](research-cli-as-agent-skill.md)

* * *

## Executive Summary

The current tbd guideline is behind the ecosystem.
It still treats `SKILL.md` as a Claude Code-only artifact under `.claude/skills/` and
treats Codex primarily as an `AGENTS.md` consumer.
That was a reasonable interim model, but the Agent Skills ecosystem has converged on
`SKILL.md` as a cross-agent capability format, with `.agents/skills/` as the
project-local interoperability path used by Codex, Cursor, Gemini CLI, GitHub Copilot,
Amp, Cline, and others.

tbd should use a combination:

1. Keep `AGENTS.md` for always-on repository orientation, tbd operating protocol, and
   broad agent instructions.
2. Add `.agents/skills/tbd/SKILL.md` as the default project-local Agent Skills install
   target.
3. Continue installing or mirroring `.claude/skills/tbd/SKILL.md` for Claude Code, since
   Claude Code still documents `.claude/skills/` as its native path.
4. Publish a source/distribution copy at `skills/tbd/SKILL.md` so registries and
   installers such as `npx skills add` can discover it cleanly.

The conclusion is not “replace `.claude/skills/`.” It is “stop making `.claude/skills/`
the canonical path.”
The canonical portable location should be `.agents/skills/`; native agent paths are
compatibility mirrors.

**Research Questions**:

1. Is Agent Skills now a real cross-agent standard rather than a Claude-only feature?
2. What paths do current major agents and popular skill packs use?
3. How far behind are tbd’s guidelines and setup behavior?
4. What migration should tbd make?

* * *

## Research Methodology

### Approach

This research reviewed:

- Official Agent Skills documentation and implementor guidance.
- Official or primary documentation for Claude Code, Codex, Gemini CLI, Cursor, and the
  Vercel `skills` installer.
- Public behavior of current popular skill systems: Garry Tan’s `gstack`, GSD, Jesse
  Vincent’s `obra/superpowers`, Vercel `agent-skills`, OpenAI’s skills catalog, and the
  skills.sh leaderboard.
- The current tbd implementation and guidelines in this repository.

### Sources

- Agent Skills: https://agentskills.io
- Agent Skills specification: https://agentskills.io/specification
- Agent Skills implementor guide:
  https://agentskills.io/client-implementation/adding-skills-support
- Claude Code skills docs: https://code.claude.com/docs/en/skills
- OpenAI Codex AGENTS.md docs: https://developers.openai.com/codex/guides/agents-md
- OpenAI Codex skills docs: https://developers.openai.com/codex/skills
- OpenAI Codex hooks docs: https://developers.openai.com/codex/hooks
- OpenAI skills catalog: https://github.com/openai/skills
- Gemini CLI skills docs:
  https://geminicli.com/docs/cli/tutorials/skills-getting-started/
- Gemini CLI skill management docs: https://geminicli.com/docs/cli/using-agent-skills/
- Cursor 2.4 changelog: https://cursor.com/changelog/2-4
- Cursor agent best practices: https://cursor.com/blog/agent-best-practices
- Vercel skills announcement:
  https://vercel.com/changelog/introducing-skills-the-open-agent-skills-ecosystem
- Vercel skills supported agents:
  https://www.mintlify.com/vercel-labs/skills/guides/supported-agents
- skills.sh: https://skills.sh/
- gstack: https://github.com/garrytan/gstack
- GSD skill docs: https://getshitdone.help/skills-extensions-agents/
- Superpowers: https://github.com/obra/superpowers

### 2026-05-24 Refresh Notes

The plan refresh re-checked the external sources that determine path and hook strategy:

- Codex’s current skills docs explicitly say Codex reads repository skills from
  `.agents/skills` in the current working directory, ancestor directories, and the repo
  root; user skills live in `$HOME/.agents/skills`; admin skills live in
  `/etc/codex/skills`.
- Codex’s docs now list a hooks configuration surface.
  The implementation plan should use that official surface for Codex startup/gh CLI
  parity if the event mapping covers tbd’s current Claude lifecycle hooks.
- Gemini CLI still documents `.agents/skills/` as a user and workspace alias, with the
  alias taking precedence over `.gemini/skills/` within the same tier.
- GSD still documents `~/.agents/skills/` and project `.agents/skills/` as its skill
  directories.
- Vercel’s supported-agent table still lists Codex, Cursor, OpenCode, Cline, Amp, Gemini
  CLI, and GitHub Copilot as project installs that use `.agents/skills/`; it lists
  Claude Code as `.claude/skills/`.
- A downstream pprose audit surfaced two additional process lessons that belong in tbd’s
  guidance: generated skill instructions should prefer pinned fallback runners such as
  `uvx --from package@version`, and Codex hooks should not reference scripts stored
  under `.claude/`.

No refreshed source changed the main recommendation: `.agents/skills/` should be tbd’s
portable project skill path, `.claude/skills/` should remain a Claude Code mirror, and
`AGENTS.md` should remain a separate always-on instruction surface.

* * *

## Research Findings

### Agent Skills Standard

#### Format

**Status**: Complete

**Details**:

- The Agent Skills spec defines a skill as a directory containing `SKILL.md`.
- `SKILL.md` uses YAML frontmatter plus Markdown instructions.
- Required frontmatter fields are `name` and `description`.
- Optional directories include `scripts/`, `references/`, and `assets/`.
- The spec recommends progressive disclosure: metadata at startup, `SKILL.md` when
  activated, and supporting files on demand.
- The spec does not require a single filesystem install location.

**Assessment**: tbd’s `packages/tbd/docs/shortcuts/system/skill-minimal.md` is already
close to spec-compliant.
The larger problem is installation/distribution path strategy.

#### Path Convention

**Status**: Complete

**Details**:

- The official implementor guide recommends clients scan both native paths and the
  cross-client `.agents/skills/` convention.
- It explicitly frames `.agents/skills/` as a widely adopted sharing convention, not as
  a hard requirement of the base file-format spec.
- It also recommends pragmatic scanning of `.claude/skills/` because many existing
  skills are there.

**Assessment**: `.agents/skills/` should be treated as the canonical portable
project-local path. Native paths should be mirrors or compatibility targets.

### Major Agent Behavior

| Tool | Project Skill Path | Global/User Path | Notes |
| --- | --- | --- | --- |
| Claude Code | `.claude/skills/<name>/SKILL.md` | `~/.claude/skills/<name>/SKILL.md` | Official docs still center `.claude/skills/`. |
| Codex | `.agents/skills/` from CWD through repo root | `~/.agents/skills/`; admin `/etc/codex/skills`; installed plugin skills | Official Codex docs now directly document `.agents/skills` repo discovery. |
| Cursor | `.agents/skills/` per skills CLI support | `~/.cursor/skills/` | Changelog and best-practices docs support Agent Skills; path docs are thinner than Claude/Gemini. |
| Gemini CLI | `.gemini/skills/` or `.agents/skills/` alias | `~/.gemini/skills/` or `~/.agents/skills/` alias | Official Gemini docs explicitly mention `.agents/skills` alias. |
| GitHub Copilot | `.agents/skills/` per skills CLI support | `~/.copilot/skills/` | Included in Vercel skills supported-agent table. |
| Amp | `.agents/skills/` per skills CLI support | `~/.config/agents/skills/` | Included in Vercel skills supported-agent table. |
| OpenCode | `.agents/skills/` per skills CLI support | `~/.config/opencode/skills/` | Included in Vercel skills supported-agent table. |

**Assessment**: The market no longer maps “Codex integration” to `AGENTS.md` only.
Codex still uses `AGENTS.md` for repository instructions, but it also supports Agent
Skills as capability packages.

### AGENTS.md Block Tradeoff

**Status**: Complete

**Details**:

- OpenAI’s Codex docs describe `AGENTS.md` as a project instructions file and show
  global, repo-root, and nested instruction layering.
  The docs also expose `project_doc_max_bytes`, with examples using a 65,536-byte cap.
- Cursor documents `AGENTS.md` as a simple Markdown alternative to `.cursor/rules` for
  straightforward project instructions.
- This makes `AGENTS.md` valuable for always-on behavior: repo rules, required commands,
  task tracking expectations, and the one or two commands an agent should run to orient
  itself.
- The same always-on property creates a bloat risk.
  A generated block that includes the full skill body plus shortcut/guideline
  directories consumes prompt budget before the agent knows whether it needs tbd.

**Assessment**: Keep a tbd-managed `AGENTS.md` block, but make it a compact bootstrap.
The block should say what tbd is, when agents must use it, and where to get more context
(`tbd prime`, `tbd skill`, `tbd shortcut --list`, `tbd guidelines --list`). It should
not embed the full `SKILL.md` or full shortcut/guideline tables.

**tbd implication**: Current tbd setup writes a large generated tbd block into
`AGENTS.md`. The modernization work should replace that with a shorter marked block and
move detailed resource discovery into `.agents/skills/tbd/SKILL.md` and CLI commands.
Because existing repositories may already have the old marked block, the replacement
needs a migration signal, not just different text.
A stable outer marker plus an internal metadata comment such as
`<!-- tbd:integration-format=2; surface=agents-md -->` lets setup distinguish “current,”
“legacy generated,” and “user-owned/unmarked” states while preserving user content
outside the managed region.

### Popular Modern Skill Systems

#### gstack

**Status**: Complete

**Details**:

- `gstack` describes itself as a collection of `SKILL.md` files for structured roles.
- Its `AGENTS.md` says skills live in `.agents/skills/`, with `~/.claude/skills/gstack/`
  as the Claude Code path.
- It generates host-specific output, including Codex-specific output.
- It keeps generated `SKILL.md` files separate from templates.

**Assessment**: gstack is already doing the “portable `.agents/skills/` plus Claude
compatibility” model tbd should adopt.

#### Get Shit Done

**Status**: Complete

**Details**:

- GSD reads skills from `~/.agents/skills/` and project `.agents/skills/`.
- It installs skills through the `skills.sh` CLI.
- It treats skills as shared, cross-agent capability packages rather than a Claude-only
  construct.
- It tracks skill usage and health in its own workflow.

**Assessment**: GSD is a strong signal that newer agent workflow tools are using
`.agents/skills/` as their primary path.

#### Superpowers

**Status**: Complete

**Details**:

- `obra/superpowers` ships a `skills/` directory and per-host plugin manifests.
- It supports Claude Code, Codex CLI/App, Factory Droid, Gemini CLI, OpenCode, Cursor,
  and GitHub Copilot CLI.
- Installation is host-specific through plugin marketplaces or extensions, but the
  underlying unit is still `SKILL.md`.
- The project emphasizes that skill changes must work across supported coding agents.

**Assessment**: Superpowers’ repo-local `skills/` directory plus per-host manifests is
the clean publication model.
tbd should keep `skills/tbd/SKILL.md` for distribution, even if `tbd setup --auto`
installs into `.agents/skills/` and `.claude/skills/`.

#### skills.sh and Official/Commercial Packs

**Status**: Complete

**Details**:

- Vercel’s `skills` CLI installs skill packages with `npx skills add <owner/repo>`.
- Vercel lists support for Claude Code, Cursor, Codex, GitHub Copilot, Windsurf, Gemini,
  Cline, Amp, Antigravity, Goose, Kiro CLI, OpenCode, Roo, and others.
- The skills.sh leaderboard shows broad adoption by official and community packs:
  Anthropic, OpenAI, Vercel, Microsoft Azure, Supabase, Firebase, Remotion,
  obra/superpowers, Matt Pocock’s skills, and others.

**Assessment**: The discoverability ecosystem has moved to repo-level skill directories
and portable installers.
tbd should be installable through this ecosystem without requiring users to know
Claude-specific paths.

### Current tbd State

#### Guidelines

**Status**: Complete

**Details**:

- `packages/tbd/docs/guidelines/cli-agent-skill-patterns.md` maps:
  - Claude Code to `.claude/skills/name/`
  - Cursor to `.cursor/rules/`
  - Codex to root `AGENTS.md`
- The same guideline recommends `.claude/skills/` and `.cursor/rules/` in its summary.
- It does mention Agent Skills and skills.sh later, but the core installation advice is
  stale.

**Assessment**: The guideline is not fully up to date.
It should distinguish `AGENTS.md` from Agent Skills and recommend `.agents/skills/` as
the default portable skill target.

#### Product Behavior

**Status**: Complete

**Details**:

- `packages/tbd/src/lib/integration-paths.ts` defines `CLAUDE_SKILL_REL` as
  `.claude/skills/tbd/SKILL.md`.
- `tbd setup --auto` installs Claude hooks and the generated skill only to
  `.claude/skills/tbd/SKILL.md`.
- Codex setup writes the tbd section to `AGENTS.md`.
- No setup path currently writes `.agents/skills/tbd/SKILL.md`.
- The active skills.sh plan already recognized the need for `skills/tbd/SKILL.md`, but
  that work is not complete.

**Assessment**: tbd’s implementation is also behind the current ecosystem.
Updating only the guideline would leave the CLI behavior inconsistent with the
recommendation.

* * *

## Comparative Analysis

| Option | Description | Pros | Cons | Recommendation |
| --- | --- | --- | --- | --- |
| Claude-only | Keep `.claude/skills/tbd/SKILL.md` as the only skill install target | Simple; current behavior | Excludes Codex/Cursor/Gemini/OpenCode skill discovery; stale guidance | No |
| AGENTS.md-only for Codex | Keep Codex guidance only in root `AGENTS.md` | Good always-on orientation | Not a reusable skill; no progressive disclosure; no skills.sh compatibility | No |
| `.agents/skills/` only | Install project skill only to `.agents/skills/tbd/SKILL.md` | Portable default for many tools | Claude Code may not see it unless it scans `.agents`; breaks current Claude users | No |
| `.agents/skills/` plus Claude mirror | Install canonical portable skill and mirror to `.claude/skills/tbd/SKILL.md` | Best cross-agent coverage; backward compatible with Claude Code | Need copy/symlink policy and status checks | Yes |
| Per-agent native directories | Install to `.agents/`, `.claude/`, `.gemini/`, `.cursor/`, `.codex/`, etc. | Maximum explicitness | File proliferation, drift risk, more cleanup code | Only if specific tool needs it |

* * *

## Recommendations

### Summary

Use `.agents/skills/` as the canonical project-local Agent Skills install path, keep
`.claude/skills/` as a compatibility mirror for Claude Code, and keep `AGENTS.md` as a
separate always-on instruction surface.

### Recommended tbd Changes

1. **Update `cli-agent-skill-patterns.md`**
   - Replace the old “Codex = AGENTS.md” model with “Codex = `AGENTS.md` plus
     `.agents/skills/` for reusable skills.”
   - Replace “Cursor = `.cursor/rules/`” with a split: `.cursor/rules/` for
     always-on/static rules, `.agents/skills/` for dynamic skills.
   - Make `.agents/skills/<name>/SKILL.md` the default portable path.
   - Document `.claude/skills/<name>/SKILL.md` as Claude Code’s native mirror.

2. **Update `tbd setup --auto`**
   - Generate a single `SKILL.md` payload.
   - Write it to `.agents/skills/tbd/SKILL.md`.
   - If Claude Code is detected, mirror the same payload to
     `.claude/skills/tbd/SKILL.md`.
   - Keep updating `AGENTS.md` for Codex and AGENTS-compatible tools, using a compact
     versioned managed block so old generated blocks can be upgraded safely.
   - Upgrade prior setup installs item-by-item: add missing `.agents/skills`, refresh
     old `.claude/skills` mirrors, replace legacy `AGENTS.md` managed blocks, and dedupe
     only tbd-owned hook entries.
   - Add Codex lifecycle hook setup where official Codex hooks support the same behavior
     as Claude Code’s current `SessionStart`, `PreCompact`, gh CLI bootstrap, and
     close-protocol reminder hooks.

3. **Add publication source**
   - Add `skills/tbd/SKILL.md` at the repo root for skills.sh and direct GitHub
     installation.
   - Generate or validate it from `skill-minimal.md` to avoid drift.

4. **Update doctor/status/tests**
   - Report both “Agent Skills portable path” and “Claude Code skill mirror”.
   - Treat `.agents/skills/tbd/SKILL.md` as the primary skill install status.
   - Add setup golden tests proving both files are produced and contain valid
     frontmatter.

5. **Validate with current tooling**
   - Run `skills-ref validate skills/tbd`.
   - Run `npx skills add /path/to/tbd --list`.
   - Test with Claude Code, Codex, Gemini CLI, Cursor, and OpenCode where feasible.

### Copy vs Symlink

Prefer copy by default for project-local installs.
Symlinks are elegant but behave unevenly across Windows, sandboxes, package managers,
and remote agent worktrees.
Copying the same generated payload to `.agents/skills/tbd/SKILL.md` and
`.claude/skills/tbd/SKILL.md` is more boring and more reliable.

### Backward Compatibility

Do not remove `.claude/skills/tbd/SKILL.md` automatically.
Existing Claude Code users depend on it, and Claude Code’s official documentation still
uses that path. Instead, make `.agents/skills/tbd/SKILL.md` primary and keep the Claude
path synchronized when Claude Code is detected.

* * *

## Open Research Questions

1. **Should tbd support global skill installation?** tbd currently has a project-local
   integration policy. Global skills are common in the ecosystem (`~/.agents/skills/`,
   `~/.claude/skills/`, `$CODEX_HOME/skills`), but adopting them would be a deliberate
   product policy change.

2. **Should `tbd setup --auto` always write `.agents/skills/` even when no skill-aware
   agent is detected?** The portability argument says yes.
   The current tbd pattern is detection-based.
   A reasonable compromise is to always install `.agents/skills/` after `tbd init`,
   because it is project-local and harmless.

3. **Should the `skills/tbd/SKILL.md` publication copy be generated at build time or
   committed?** Committed files are friendlier to skills.sh and GitHub browsing.
   Generated files reduce drift.
   The likely answer is “committed, with a validation test that regenerates and
   compares.”

* * *

## References

- Agent Skills overview: https://agentskills.io/home
- Agent Skills specification: https://agentskills.io/specification
- Client implementor guide:
  https://agentskills.io/client-implementation/adding-skills-support
- Claude Code skills: https://code.claude.com/docs/en/skills
- Codex skills: https://developers.openai.com/codex/skills
- OpenAI skills catalog: https://github.com/openai/skills
- Gemini CLI skills getting started:
  https://geminicli.com/docs/cli/tutorials/skills-getting-started/
- Gemini CLI skill management: https://geminicli.com/docs/cli/using-agent-skills/
- Cursor 2.4 changelog: https://cursor.com/changelog/2-4
- Cursor agent best practices: https://cursor.com/blog/agent-best-practices
- Vercel skills changelog:
  https://vercel.com/changelog/introducing-skills-the-open-agent-skills-ecosystem
- Vercel skills supported agents:
  https://www.mintlify.com/vercel-labs/skills/guides/supported-agents
- skills.sh directory: https://skills.sh/
- Garry Tan gstack: https://github.com/garrytan/gstack
- GSD skills/extensions/agents: https://getshitdone.help/skills-extensions-agents/
- Jesse Vincent Superpowers: https://github.com/obra/superpowers
