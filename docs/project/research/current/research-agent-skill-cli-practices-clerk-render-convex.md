---
title: Agent-Skill & CLI Packaging Practices — Clerk, Render, Convex
description: Research into how three production vendors (Clerk, Render, Convex) package their agent skills and integrate their CLIs — installation layouts, CLI agent-mode patterns, and distinctive techniques worth learning from.
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Agent-Skill & CLI Packaging Practices — Clerk, Render, Convex

**Observed:** 2026-06-03 (point-in-time snapshot; these bundles iterate quickly)

## Purpose

Research into how three major, shipped vendor agent-skill bundles — **Clerk** (~21
skills + `clerk` CLI), **Render** (~21 skills + `render` CLI + hosted MCP), and
**Convex** (6 skills + `npx convex ai-files`) — actually package their agent skills and
wire up their CLIs.

The aim is to learn from real production practice: how each tool structures its
install/distribution, what agent-mode patterns its CLI uses, and which techniques are
distinctive and worth adopting.
Findings are related to our own `cli-agent-skill-patterns` guideline where useful, but
the subject here is the **tools themselves**, not a scorecard.

## Scope and caveats

- **Small, single-genre sample.** Three vendors, all infra/platform tools (auth,
  hosting, backend). That genre shares assumptions (a hosted control plane, an existing
  API, deploy/secret workflows), so treat any “the ecosystem does X” generalization
  cautiously — it may be “infra vendors do X.”
- **Versions not pinned.** Observed from the bundles as installed on 2026-06-03; exact
  bundle versions/commit SHAs were not recorded.
  Specific `SKILL.md:line` cites are therefore point-in-time and may drift as vendors
  ship updates.
- **“Gap” ≠ defect.** Observations are informed by patterns we’ve found useful, but a
  divergence from our practice is often a defensible trade-off given the vendor’s
  constraints. Those are called out inline rather than scored as mistakes.

## Installation & distribution approaches

The single most striking finding: **all three install differently, and no two share a
layout.**

| Vendor | Canonical location | Claude mirror | Codex companion | Install command | Version/format stamp |
| --- | --- | --- | --- | --- | --- |
| **Clerk** | `.agents/skills/clerk*` (real dirs, committed) | `.claude/skills/clerk*` as **committed symlinks** | none | `clerk init` (`--no-skills` opt-out); `clerk skill install` | per-skill `metadata.version`, uncoordinated; no `DO NOT EDIT` |
| **Render** | **none** — real dirs **only** in `.claude/skills/render-*` | n/a (it *is* the only copy) | none | `render skills install\|update\|list` | uniform `metadata.version` (mostly `1.0.0`); no format stamp, no `DO NOT EDIT` |
| **Convex** | `<package>/.agents/skills/convex*` (scoped to one subdir) | **none** | **`agents/openai.yaml` on every non-router skill** | `npx convex ai-files install` (+ skills) | no `license`/`version` in frontmatter; drift tracked in sidecar `ai-files.state.json` |

- **Clerk** commits a portable canonical copy under `.agents/skills/` *and* a Claude
  mirror under `.claude/skills/` — but the mirror is **committed symlinks**. Symlinks
  are fragile across Windows, sandboxes, and worktrees, so a committed, shared tree
  usually wants real copies; symlinks are safe mainly for single-machine installs.
- **Render** is **Claude-only**: real dirs live **only** in `.claude/skills/`, with no
  `.agents/skills/` canonical copy and no Codex companion.
  Non-Claude agents (Codex, Gemini, Cursor) see nothing.
- **Convex** is **portable-only and subdir-scoped**: skills live in one package’s
  `.agents/skills/` with no `.claude/skills/` mirror.
  Codex walks nested `.agents/skills/` per directory so it finds them, but Claude Code
  (which keys off `.claude/skills/`) won’t surface them from the repo root.
  The subdir scoping itself is a *smart* fit for a monorepo where Convex only applies to
  one package — the missing Claude mirror is the only real cost.

**Synthesis:** the union of what each vendor got right — a portable `.agents/` canonical
copy (Clerk, Convex), a Claude mirror (Clerk), and a Codex companion (Convex) — is the
complete layout, but no single vendor ships all of it.

## Per-vendor deep dives

### Clerk — most mature CLI-integration layer

**Notable techniques:**

- **Sandbox/host “warn-once” contract.** `clerk-cli` detects when host-only state
  (keychain, home dir, network, browser, localhost OAuth callback) is unavailable in a
  sandbox, emits a one-time warning, and instructs the agent to treat any
  auth/link/env/API failure from that run as **untrusted until rerun on the host**
  (`clerk-cli/SKILL.md:40-61`, `references/agent-mode.md`). The strongest
  sandbox-handling pattern in the sample — well beyond a bare “degrade gracefully.”
- **First-class `doctor --json`** with per-check `{status, remedy, fix}` and a
  documented failing-check → remediation-command table; the skill tells the agent to
  parse `remedy` rather than blindly auto-fix (`clerk-cli/SKILL.md:91-98`).
- **Context-flood discipline:** “save a large GET to a file, then `jq`” with Python/Node
  fallbacks and per-page files (`clerk-cli/SKILL.md:168-193`).
- **Dry-run gating** of every mutation, repeated consistently; in agent mode dry-run is
  framed as “the only safety net” (`clerk-cli/SKILL.md:144-160,250-256`).
- **`--input-json <json|@file|->`** universal flag-expansion for agents; a **deploy
  “handoff”** that turns an inherently-interactive command read-only and emits a JSON
  handoff plus a separate `deploy status --wait` verification gate.
- **`evals/evals.json` + `templates/<scaffold>`**: 14 of 21 skills ship an acceptance
  harness pairing prompts/assertions with a scaffold fixture.
- **SDK version-detection table** (Core 2 vs current) + inline `> Core 2 ONLY` callouts,
  with version-split `core-2/` / `core-3/` reference dirs where APIs diverged.
- **`allowed-tools` scoped on nearly every skill** (`WebFetch`, widened to
  `Bash, Read, Grep, Skill, WebFetch` only where scripts run).

**Gaps & rough edges:**

- **21 listing slots, and the router doesn’t reduce them.** The `clerk` router is good
  for routing, but all 21 sub-skills still each consume a listing slot.
  (Trade-off: 21 named, individually-discoverable skills may also activate more reliably
  than one opaque entry — slot budget vs.
  discoverability is a genuine tension, not a flat loss.)
- **Unpinned runner**, 5× `bunx clerk@latest` / `npx -y clerk@latest`; **templates pin
  everything to `"latest"`** (`next`, `react`, `@clerk/nextjs`, `typescript`).
- **`clerk-cli` over-documents:** a ~25-row “Core commands at a glance” flag table
  despite its own “`--help` is the source of truth” disclaimer.
- **Overlap / conflicting conventions:** `clerk-cli` ("reach for `clerk` first, not
  curl") vs `clerk-backend-api` (ships raw `curl` recipes) cover the same Backend API
  differently.
- **Inconsistent frontmatter/versioning** across the bundle; **committed symlinks** in
  `.claude/`; **partial eval coverage** (no evals for the mutation-capable `clerk-cli`).

### Render — strongest content, thinnest distribution

**Notable techniques:**

- **`assets/*.yaml` runnable template library** (6 `render.yaml` blueprints in
  `render-deploy/assets/`) — copy-paste-ready IaC seeds, kept distinct from prose
  references.
- **Disciplined progressive disclosure:** every body stays small; heavy content lives
  one level deep (e.g. `render-deploy/references/blueprint-spec.md` is 718 lines, kept
  out of the body). One skill has an **11-file reference decomposition by concern**.
- **Real cross-skill graph:** every skill ends with “Related Skills” and links inline.
- **“Common Mistakes” tables** as a reusable failure-mode-first convention.
- **Excellent agent-friendly CLI docs:** `-o json`, `--confirm`, `--wait`, output-format
  precedence (`--output` > `RENDER_OUTPUT` > TTY auto-detect); a CI example that fails
  on deploy failure.
- **Deeplink-to-Dashboard handoff** (with SSH→HTTPS git-URL conversion) for steps that
  shouldn’t be automated; **a prerequisite `render-mcp` skill** other skills depend on;
  **tool-limitation-as-routing-rule** ("MCP cannot create image-backed services — use
  the Dashboard").
- **Strong secret depth** in `render-env-vars` (`sync: false`, `generateValue: true`,
  secret-file paths, “never commit real secrets”).

**Gaps & rough edges:**

- **Claude-only, non-portable install** (the biggest gap): real dirs **only** in
  `.claude/skills/`, no `.agents/skills/` canonical, no Codex companion, no AGENTS.md
  block — so non-Claude agents see nothing.
- **~21 flat skills, no router/meta-skill** — several are topic pages (`render-disks`,
  `render-domains`, `render-networking`, `render-scaling`) that could be informational
  `render <topic>` subcommands behind one slot.
- **MCP-first, CLI-fallback** — and this is the most interesting choice in the sample.
  Action skills label **“MCP tools (preferred)” / “CLI (fallback)”** (`render-debug`,
  `render-monitor`, `render-deploy:97,125`) with no stated cost/reliability rationale.
  Token-cost benchmarks favor a local CLI heavily, but Render ships a **hosted** MCP
  whose value is largely *orthogonal* to that axis: managed auth (no API token to place
  on the box), nothing to install or bootstrap in an ephemeral CI runner, and
  remote-only capabilities the CLI can’t reach (e.g. it explicitly routes
  image-backed-service creation to the Dashboard).
  For a hosting vendor whose control plane is the product, preferring the hosted surface
  is a rational default — the trade-off is token cost and per-tool schema overhead vs.
  zero-bootstrap managed access.
- **Restating, not routing:** `render-cli` has a command table in the body **and** a
  separate `references/command-cheatsheet.md` that re-transcribes the same commands.
- **No version/format stamp, no `DO NOT EDIT`, `allowed-tools` never scoped** — so
  `render skills update` has no safe-resync marker and no least-privilege.
- **Trigger-terms inconsistent:** newer skills front-load keywords; older ones (deploy,
  debug, monitor) ship thin single-line descriptions.

### Convex — best Codex integration, lightest packaging hygiene

**Notable techniques:**

- **`agents/openai.yaml` Codex companion on every non-router skill** — a uniform shape
  (`interface.display_name/short_description/icon_small/icon_large/brand_color/default_prompt`,
  `policy.allow_implicit_invocation`). The `default_prompt` encodes *judgment* (the
  perf-audit skill: “suggest the smallest high-impact fix before bigger structural
  changes”), and each skill gets distinct branding (unique `brand_color` + icon), not
  templated filler.
- **Lightweight 53-line router** that points at install first, gives a 5-row routing
  table, and ends with a **“When Not to Use”** — a good altitude for a meta-skill.
- **Symmetric “When to Use” / “When Not to Use” on every skill**, with concrete negative
  scope that sharply reduces mis-activation.
- **Best-in-class agent-mode CLI guidance:**
  `CONVEX_AGENT_MODE=anonymous npx convex dev --once`, an explanation of why the watcher
  must not run in the foreground, and `--once` framed as the agent’s
  typecheck/validation loop (`convex-quickstart/SKILL.md:95-115,318-338`).
- **Embedded “Guardrails” / “Escalate Larger Fixes”** sections that bake cost/risk
  escalation into the skill body — encoding “seek clarification on high-cost changes.”
- **`ai-files.state.json` drift tracking** (`guidelinesHash`, `claudeMdHash`,
  `agentSkillsSha`) so `npx convex ai-files install` can detect stale guidance.

**Gaps & rough edges:**

- **No `.claude/skills/` mirror** → Claude Code can’t discover the bundle from the repo
  root.
- **`npx convex` unpinned (39×)**; the skills even acknowledge version drift but don’t
  pin.
- **Router description too thin** ("Routes general Convex requests…") vs Clerk’s
  keyword-rich router — under-indexed for activation.
- **No `license`/`version`/`allowed-tools` in any frontmatter**; `convex deploy` to prod
  runs from a skill with no tool gating.
- **`_generated/ai/guidelines.md` has no `DO NOT EDIT` / version header** despite living
  in `_generated/` and being committed — inviting a hand-edit that the next regenerate
  silently loses.
- **Dual-layer redundancy / context cost:** `CLAUDE.md` says “always read the 19.5 KB
  generated guidelines first,” pulling the full ruleset into context on *every* Convex
  task — at odds with the skills’ own on-demand model and partly redundant with them.

## Cross-cutting patterns

**Shared strengths (a rough consensus on what good looks like):** progressive disclosure
with references one level deep; two-part / trigger-keyword descriptions (where
consistent); "Common Mistakes"-style tables; agent-mode CLI awareness (`--json`,
non-interactive); bundling runnable resources (templates/assets); CLI-driven
self-install.

**Shared gaps (where all three independently land in the same place):**

1. **Unpinned zero-install runners** (`@latest`) — every vendor does this.
2. **No `format=fNN` / `DO NOT EDIT` stamp** on generated skills.
   None can mark a generated artifact as machine-owned — though the practical harm
   depends on the update model: a vendor that *fully overwrites* on `update` needs the
   stamp less than one that commits and hand-edits.
3. **`allowed-tools` rarely/never scoped** (Clerk partial; Render/Convex none).
4. **Listing-slot economics largely ignored** — Clerk 21, Render 21, Convex 6; routers
   aid navigation but don’t reduce the slot count.
   (As noted under Clerk, more slots also buy discoverability, so this is a trade-off
   rather than a pure cost.)
5. **Partial portability** — each picks one or two of {portable `.agents/` canonical,
   `.claude/` mirror, Codex companion} and skips the rest.

## Techniques worth adopting

The distinctive patterns most worth lifting into our own practice:

- **Sandbox/host “warn-once + untrusted-until-rerun-on-host” contract** (Clerk) — for
  any CLI that touches keychain / home-dir / network.
- **`doctor --json` with per-check `remedy`/`fix` + a remediation table** (Clerk).
- **Interactive “handoff” + separate verification gate**, and **deeplink-to-Dashboard**
  handoff (Clerk, Render) — how a skill should handle steps that genuinely can’t be
  automated.
- **`agents/openai.yaml` Codex companion** (Convex) — a clean, uniform recommended
  shape, with `allow_implicit_invocation` as an explicit activation knob and per-skill
  branding.
- **`evals/evals.json` + scaffold fixtures** (Clerk) — a skill acceptance-test
  convention.
- **Embedded “Guardrails” / “Escalate Larger Fixes” section type** (Convex) for any
  skill that can trigger invasive changes.
- **`assets/` runnable-template library** (Render) as a resource class distinct from
  prose references.
- **Hash-tracked generated-guidance refresh** (`ai-files.state.json`, Convex) as a
  distribution channel complementary to skills.
- **“Save big output to a file, then `jq`”** context-budget discipline (Clerk).
- **Symmetric “When to Use / When Not to Use”** on every skill (Convex) to cut
  mis-activation.

## Relevance to our guidelines

These learnings inform our `cli-agent-skill-patterns` guideline — both new patterns it
doesn’t yet cover (the list above) and existing rules the sample suggests we should
state more forcefully (pinning, generated-artifact stamping, `allowed-tools`,
listing-slot economics, portability).
The Render MCP-first choice is also a useful prompt to make our CLI-vs-MCP stance
address *hosted* MCP explicitly rather than assume a local binary.
Concrete edits are tracked in
[plan-2026-06-03-tbd-agent-cli-guideline-improvements.md](../../specs/active/plan-2026-06-03-tbd-agent-cli-guideline-improvements.md);
the guideline itself is
[packages/tbd/docs/guidelines/cli-agent-skill-patterns.md](../../../../packages/tbd/docs/guidelines/cli-agent-skill-patterns.md).

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
