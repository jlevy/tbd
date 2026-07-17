---
title: Agent-Skill & CLI Packaging Practices — Clerk, Render, Convex, GitLab
description: Research into how four production vendors (Clerk, Render, Convex, GitLab) package their agent skills and integrate their CLIs — installation layouts, CLI agent-mode patterns, and distinctive techniques worth learning from.
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Agent-Skill & CLI Packaging Practices — Clerk, Render, Convex, GitLab

**Observed:** 2026-06-03 (Clerk/Render/Convex), 2026-06-04 (GitLab) — point-in-time
snapshots; these bundles iterate quickly

## Purpose

Research into how four major, shipped vendor agent-skill bundles — **Clerk** (~21 skills
\+ `clerk` CLI), **Render** (~21 skills + `render` CLI + hosted MCP), **Convex** (6
skills + `npx convex ai-files`), and **GitLab** (2 bundled skills + a curated remote
registry, all embedded in the `glab` CLI) — actually package their agent skills and wire
up their CLIs.

The aim is to learn from real production practice: how each tool structures its
install/distribution, what agent-mode patterns its CLI uses, and which techniques are
distinctive and worth adopting.
Findings are related to our own `cli-agent-skill-patterns` guideline where useful, but
the subject here is the **tools themselves**, not a scorecard.

## Scope and caveats

- **Small, near-single-genre sample.** Three of the four (Clerk, Render, Convex) are
  infra/platform tools (auth, hosting, backend) that share assumptions — a hosted
  control plane, an existing API, deploy/secret workflows — so treat any “the ecosystem
  does X” generalization cautiously; it may be “infra vendors do X.” **GitLab (`glab`)
  is deliberately included as a fourth, adjacent-genre data point:** a git-forge CLI
  whose primary surface is local Git/issue/MR commands, not a remote control plane.
  It turns out to break two of the “shared gaps” the infra trio land in (see
  Cross-cutting patterns), which is exactly the kind of divergence a genre-crossing
  sample exists to surface.
- **Versions not pinned.** Observed from the bundles as installed on 2026-06-03; exact
  bundle versions/commit SHAs were not recorded.
  Specific `SKILL.md:line` cites are therefore point-in-time and may drift as vendors
  ship updates.
- **“Gap” ≠ defect.** Observations are informed by patterns we’ve found useful, but a
  divergence from our practice is often a defensible trade-off given the vendor’s
  constraints. Those are called out inline rather than scored as mistakes.

## Installation & distribution approaches

The single most striking finding: **all four install differently, and no two share a
layout.**

| Vendor | Canonical location | Claude mirror | Codex companion | Install command | Version/format stamp |
| --- | --- | --- | --- | --- | --- |
| **Clerk** | `.agents/skills/clerk*` (real dirs, committed) | `.claude/skills/clerk*` as **committed symlinks** | none | `clerk init` (`--no-skills` opt-out); `clerk skill install` | per-skill `metadata.version`, uncoordinated; no `DO NOT EDIT` |
| **Render** | **none** — real dirs **only** in `.claude/skills/render-*` | n/a (it *is* the only copy) | none | `render skills install\|update\|list` | uniform `metadata.version` (mostly `1.0.0`); no format stamp, no `DO NOT EDIT` |
| **Convex** | `<package>/.agents/skills/convex*` (scoped to one subdir) | **none** | **`agents/openai.yaml` on every non-router skill** | `npx convex ai-files install` (+ skills) | no `license`/`version` in frontmatter; drift tracked in sidecar `ai-files.state.json` |
| **GitLab** | `.agents/skills/<name>` (project) / `~/.agents/skills/` (`--global`) / `--path`; **embedded in the `glab` binary** via `go:embed`, materialized on install | **none — by design** (bets on the shared `.agents/skills/` standard) | **none — same bet** (one dir is documented as serving Claude Code, Codex, Gemini CLI, GitLab Duo) | `glab skills install [name]` / `list` / `update [--all]` | no per-skill stamp, but **unnecessary**: skills version = the `glab` release; `update` re-derives a sha256 content-hash and atomically overwrites only on drift |

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
- **GitLab** is **`.agents/`-only by conviction**: it writes real dirs to
  `.agents/skills/` (the agentskills.io standard) and ships **no** Claude mirror and
  **no** Codex companion — not as an omission but as a bet that the single cross-agent
  directory is enough, with Claude Code, Codex, Gemini CLI, and GitLab Duo all
  documented as reading from it.
  The skills are **embedded in the `glab` binary** (`go:embed`), so there is no separate
  skill artifact to version: the installed copy’s “version” is whichever `glab` you ran.
  `glab skills update` then re-fetches and overwrites **only if a sha256 over the file
  tree differs** from the source — so drift detection replaces the version/format stamp
  the other three lack.

**Synthesis:** the union of what the infra trio got right — a portable `.agents/`
canonical copy (Clerk, Convex), a Claude mirror (Clerk), and a Codex companion (Convex)
— looks like the complete layout, and no single one of them ships all of it.
**GitLab reframes the question:** the mirror and the companion are only *necessary*
because not every agent reads `.agents/skills/` yet.
If the cross-agent standard holds, `glab`’s single-directory layout *is* the complete
layout, and the mirrors are transitional scaffolding rather than the target state.
So the honest reading is two defensible bets — “mirror per agent today” (Clerk) vs “one
standard directory and refuse to fork” (GitLab) — not one winner.

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

### GitLab (`glab`) — strongest distribution engineering, leanest slot footprint

GitLab ships the smallest bundle in the sample — two skills, `glab` and `glab-stack`,
embedded directly in the `glab` binary, plus a curated registry that points at skills
hosted in *other* gitlab.com repos.
What stands out is not the content volume but the **packaging machinery and the
agent-mode discipline of the one core skill.** (Observed from `gitlab-org/cli`
`internal/commands/skills/` on 2026-06-04; the feature is marked EXPERIMENTAL — “may be
unstable or removed.”)

**Notable techniques:**

- **Skills embedded in the versioned CLI binary** (`go:embed all:assets`) — the skill
  *is* the release. This sidesteps the whole “no `version`/format stamp” problem the
  other three share: there is no independent artifact to stamp because the `glab` you
  ran is the version. The one validation enforced at load is that each skill’s
  frontmatter `name` **must equal its directory name**, with full Agent-Skills-spec
  compliance “left to hand-review.”
- **Content-hash drift detection instead of a `DO NOT EDIT` marker.**
  `glab skills update` re-derives a stable `sha256` over the entire `{path → bytes}`
  tree (length-prefixed so `(path, body)` re-splits can’t collide) and overwrites
  **only** if the on-disk hash differs from the source.
  This is a genuinely *different* solution to the generated-artifact problem: you don’t
  need to mark a file machine-owned if you can cheaply detect any hand-edit and
  re-converge.
- **Atomic, deletion-aware overwrite.** `update` writes the new tree to a sibling temp
  dir, then `RemoveAll(skillDir)` + `Rename` — so a failed write can’t leave a partial
  skill, *and* files removed upstream don’t linger and make the on-disk hash perpetually
  differ. Production-grade resync hygiene none of the three documented.
- **Default-install-ONE, opt-in for the rest** — `glab skills install` with no argument
  installs only the core `glab` skill, with an explicit in-code rationale: doing
  otherwise would “pollute an agent’s context with descriptions of bundled skills the
  user may not need.” This is the **strongest answer to listing-slot economics in the
  whole sample**: where Clerk/Render/Convex land 21/21/6 slots, `glab` lands **one** by
  default and you add others by name.
- **Two-source registry: bundled (offline, in-binary) + curated remote
  (`registry.yaml`).** The remote registry is a small package-index-like file of
  *pointers* — `{name, description, project, ref, path}` — to skills living in other
  public gitlab.com repos (e.g. `orbit` → `gitlab-org/orbit/knowledge-graph`).
  Installing one fetches the whole directory tree at the pinned `ref` via the public
  Repository API (no auth), validates a `SKILL.md` is present, and merges it into the
  same install/update machinery.
  The registry schema is itself versioned (`version: 1`, and older binaries **refuse**
  unknown versions rather than misread them).
- **Per-entry ref pinning** with `latest | <tag> | <SHA>`; `latest` resolves to the
  project’s default branch.
  Notably this is the *one* place `glab` carries the same unpinned-`latest` smell as the
  other three — but it’s a per-entry, hand-review decision and SHAs are first-class, so
  a registry curator *can* pin hard.
- **`mcpannotations.Safe` on read-only subcommands** (e.g. `skills list`) — the CLI tags
  which commands are safe to expose over its MCP surface, a clean bridge between the CLI
  and MCP worlds.
- **Best-in-class agent-mode content in the core skill.** The `glab` `SKILL.md` is a
  near-textbook agent-mode CLI doc:
  - A deep **“Common mistakes” table** (Render-style, but sharper): `--body` is a `gh`
    flag — `glab` uses `--description`; there is no `--state` on `mr list`; scoped
    labels like `status::doing` auto-replace within their scope.
  - An explicit **“these commands hang a non-interactive agent” catalogue** — the best
    such discipline in the sample.
    It names every command that opens `$EDITOR` or a TUI and will block: `glab ci view`
    (interactive UI), `glab ci trace` (streams/blocks), `glab stack move`/`reorder`
    (fuzzy-finder / editor), and `save`/`amend` *without* `-m` (prompts interactively).
    More concrete than Convex’s “don’t run the watcher in the foreground.”
  - **Shell-quoting-safety guidance** — prefer piping the body via stdin / a quoted
    heredoc (`<< 'EOF'`) for MR notes so backticks, `$`, and backslashes stay literal,
    with per-command notes on which commands read stdin vs.
    need `glab api -F body=@file`. A distinctive agent-mode concern (safe
    non-interactive text input) none of the other three covered.
  - `--output json | jq` machine-readable patterns and an idempotent `--unique` note
    post.

**Gaps & rough edges:**

- **Claude Code won’t auto-discover from the repo root.** Like Convex, there’s **no
  `.claude/skills/` mirror** — `glab` bets entirely on agents adopting
  `.agents/skills/`. That bet is reasonable and forward-looking, but today a stock
  Claude Code install keyed to `.claude/skills/` won’t surface these without help.
- **Tiny bundle, thin coverage.** Two skills cover MRs/issues/CI and stacked diffs;
  everything else (releases, registries, security, deploy) is left to
  `glab <cmd> --help`. That’s a deliberate “the CLI’s own help is the source of truth”
  stance, but it means far less curated agent guidance than Render or Clerk for the long
  tail.
- **Remote fetch is unauthenticated, public-only, and not integrity-checked beyond the
  ref** — fine for the curated gitlab.com registry as shipped, but the model has no
  signature/checksum pinning, so trust rests entirely on the curated `registry.yaml` and
  the chosen `ref`.
- **EXPERIMENTAL surface** — the commands “might be unstable or removed at any time,” so
  anything built on `glab skills` today is building on shifting ground.

## Cross-cutting patterns

**Shared strengths (a rough consensus on what good looks like):** progressive disclosure
with references one level deep; two-part / trigger-keyword descriptions (where
consistent); "Common Mistakes"-style tables; agent-mode CLI awareness (`--json`,
non-interactive); bundling runnable resources (templates/assets); CLI-driven
self-install.

**Shared gaps — and where GitLab breaks them.** The three infra vendors independently
land in the same place on the points below; adding `glab` (an adjacent-genre fourth)
shows that two of these “gaps” are choices, not inevitabilities.

1. **Unpinned zero-install runners** (`@latest`) — all three infra vendors do this.
   `glab` **mostly avoids it** by embedding skills in a versioned binary; the lone
   exception is its remote-registry `ref`, which *can* be `latest` but supports tags and
   SHAs for a curator who wants to pin hard.
2. **No `format=fNN` / `DO NOT EDIT` stamp** on generated skills — the infra trio can’t
   mark a generated artifact as machine-owned.
   **`glab` dissolves the problem rather than filling the gap:** a `sha256` content-hash
   \+ atomic full-overwrite `update` re-converges any hand-edit, so no machine-owned
   marker is needed. (This matches the earlier note that a *full-overwrite* update model
   needs the stamp less than a commit-and-hand-edit one.)
3. **`allowed-tools` rarely/never scoped** (Clerk partial; Render/Convex/GitLab none) —
   still a genuine four-way gap; `glab`’s skills carry only `name`/`description`
   frontmatter.
4. **Listing-slot economics** — Clerk 21, Render 21, Convex 6 install everything, and
   routers aid navigation without reducing the slot count.
   **`glab` is the counter-example:** it installs **one** skill by default and makes the
   rest opt-in by name, with an explicit in-code rationale about not polluting agent
   context. (As noted under Clerk, more slots also buy discoverability, so the right
   footprint is a trade-off — but `glab` shows the lean end of it is reachable.)
5. **Portability is a fork in the road, not a checklist.** The infra trio each pick one
   or two of {portable `.agents/` canonical, `.claude/` mirror, Codex companion} and
   skip the rest; `glab` deliberately ships *only* the `.agents/` canonical and bets the
   mirrors are transitional.
   So this is less “everyone is partial” and more “two coherent stances —
   mirror-per-agent-now vs one-standard-directory — plus some genuinely incomplete
   picks.”

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
- **Content-hash drift detection + atomic, deletion-aware overwrite** (`glab`) —
  re-derive a `sha256` over the file tree and overwrite only on difference, via temp-dir
  \+ rename. An alternative to `DO NOT EDIT` / `format=fNN` stamping that also self-heals
  upstream deletions; especially apt when skills are *generated* and *fully overwritten*
  on resync.
- **Default-install-one, opt-in-by-name** (`glab`) — the cleanest lever we’ve seen for
  listing-slot economics: ship many skills but install only the core one unless asked.
- **Curated remote skill registry embedded in the CLI** (`glab` `registry.yaml`) — a
  versioned, schema-checked pointer list to skills hosted in *other* repos, fetched at a
  pinned `ref`. A distribution channel for first- *and* third-party skills without
  vendoring them into the CLI repo.
- **An explicit “these commands hang a non-interactive agent” catalogue** (`glab`) —
  name every `$EDITOR`/TUI/streaming command and the safe non-interactive substitute.
  Pairs with **stdin/heredoc shell-quoting-safety guidance** for passing
  bodies/descriptions without backtick/`$`/backslash footguns.
- **Tagging read-only subcommands MCP-safe** (`glab` `mcpannotations.Safe`) — a tidy way
  to let one CLI back a safe MCP surface without a second tool definition.

## Relevance to our guidelines

These learnings inform our `cli-agent-skill-patterns` guideline — both new patterns it
doesn’t yet cover (the list above) and existing rules the sample suggests we should
state more forcefully (pinning, generated-artifact stamping, `allowed-tools`,
listing-slot economics, portability).
The Render MCP-first choice is also a useful prompt to make our CLI-vs-MCP stance
address *hosted* MCP explicitly rather than assume a local binary.
The GitLab data point sharpens two of those rules in particular: it shows
**generated-artifact stamping** and **listing-slot economics** each have a clean,
shipped alternative (content-hash drift detection; default-install-one), so our
guideline can present these as *solved problems with a known technique* rather than open
gaps — and the `glab` “commands that hang a non-interactive agent” catalogue plus
stdin/heredoc input guidance are concrete additions to whatever agent-mode-CLI checklist
the guideline carries.
Concrete edits are tracked in
[plan-2026-06-03-tbd-agent-cli-guideline-improvements.md](../../specs/done/plan-2026-06-03-tbd-agent-cli-guideline-improvements.md);
the guideline itself is
[packages/tbd/docs/guidelines/cli-agent-skill-patterns.md](../../../../packages/tbd/docs/guidelines/cli-agent-skill-patterns.md).

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
