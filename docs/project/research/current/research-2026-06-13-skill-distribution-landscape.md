# Research Brief: Agent-Skill Distribution Landscape and Popular-Skill Patterns

**Last Updated**: 2026-06-13

**Status**: Complete

**Related**:

- [CLI as Agent Skill](./research-cli-as-agent-skill.md) (foundational research behind
  the guideline)
- [Agent Skills Standard Paths](./research-agent-skills-standard-paths.md)
- [Skills vs Meta-Skill Architecture](./research-skills-vs-meta-skill-architecture.md)
- Guideline this informs: `tbd guidelines cli-agent-skill-patterns`
  ([source](../../../../packages/tbd/docs/guidelines/cli-agent-skill-patterns.md))
- Issue motivating this pass: [jlevy/tbd#173](https://github.com/jlevy/tbd/issues/173)
  (five gaps surfaced by the `pprose` L2-ish CLI)

* * *

## Executive Summary

`cli-agent-skill-patterns` is a strong, current guideline, but it was shaped mostly by
two reference points: `tbd` itself (a full L3 platform) and `qmd` (an L2
self-installer). This brief widens the evidence base by auditing how a spread of
**actually popular and actually shipped** skills are distributed, then maps the
resulting decision framework.
It exists to make sure our research reflects mid-2026 practice and to ground the five
edits proposed in issue #173.

Two headline findings.
First, **the most-installed skills in the ecosystem are simple L0/L1 knowledge skills**,
not platforms: the skills.sh all-time leaderboard is led by Vercel’s `find-skills`
(~2.0M installs), Anthropic’s `frontend-design` (~540K), and Microsoft’s Azure skills
(~5.8M across the set).
Distribution complexity does not correlate with adoption; the opposite, if anything.
Second, there is a **real, populated rung between the guideline’s L2 and L3** that we
currently under-name: a self-installing tool that writes a compact managed `AGENTS.md`
block (with format stamping and a forward-compat guard) but takes on none of the L3
platform machinery (no hooks, no `prime`/`setup`, no DocCache).
`pprose` is a clean reference for it, and its install code already solves three problems
our guideline either ties to L3 or leaves unspecified.

The practical output is a distribution decision matrix (which channel/rung fits which
tool), a set of current-practice corrections (native per-agent skill dirs are
proliferating; Cursor now scans `.agents/skills/` natively), and concrete backing for
the issue #173 edits.

**Research Questions**:

1. How are popular, real-world skills actually distributed, and does distribution
   complexity track adoption?

2. What distribution channels exist in mid-2026, and when is each the right choice?

3. Is the L0–L3 ladder complete, or is there a missing rung between L2 and L3?

4. Which install-time concerns (format stamping, dev-build version pinning, marker
   collapse, redundant in-file tags) are universal vs rung-specific?

5. What has changed in the ecosystem since the guideline’s last substantive update
   (native per-agent skill directories, Cursor’s discovery behavior)?

* * *

## Research Methodology

### Approach

Source-level audit of cloned repositories (via the `checkout-third-party-repo` shortcut,
into `attic/`), cross-checked against the skills.sh leaderboard and curated catalogs.
Where the issue cited `pprose` source lines, each claim was verified against the working
code rather than the prose.
Ecosystem-wide claims (per-agent skill paths, Cursor discovery) were checked against
vendor docs and flagged where only community catalogs corroborate them.

### Sources

- **Cloned and read at source** (`attic/`): `Leonxlnx/taste-skill`,
  `jlevy/practical-prose` (pprose), `tobi/qmd`, `anthropics/skills`,
  `VoltAgent/awesome-agent-skills`, `heilcheng/awesome-agent-skills`.
- **Leaderboard / discovery**: [skills.sh](https://skills.sh) all-time install rankings.
- **Vendor docs**: Cursor Agent Skills docs (native `.agents/skills/` discovery), Codex
  skills loader scopes (already cited in the guideline).
- **Internal**: the guideline, the foundational research brief, the `pprose` install
  spec (`plan-2026-05-30-pprose-install-scopes-and-surfaces.md` in the pprose repo).

* * *

## Research Findings

### 1. What is actually popular (and what shape is it?)

**Status**: ✅ Complete

The skills.sh all-time leaderboard (mid-2026) is dominated by knowledge/best-practice
skills published by vendors, not by self-installing platforms:

| Rank | Skill | Publisher | Installs | Rung |
| --- | --- | --- | --- | --- |
| 1 | `find-skills` | vercel-labs/skills | ~2.0M | L0 (meta: finds other skills) |
| 2 | `frontend-design` | anthropics/skills | ~540K | L0 (prompt and scripts) |
| 3 | `vercel-react-best-practices` | vercel-labs | ~474K | L0/L1 |
| 4 | `agent-browser` | vercel-labs | ~447K | L1 (points at a tool) |
| 5 | `microsoft-foundry` | microsoft/azure-skills | ~390K | L1 (vendor SDK/CLI) |

Microsoft’s Azure skill set alone reports ~5.8M installs.
The leaders are vendor knowledge skills (React, Azure, Remotion best-practices) and
design skills.

**Assessment**: Adoption is driven by *usefulness and reach*, not by install machinery.
The highest-leverage distribution move is shipping a spec-compliant `SKILL.md` that
skills.sh and the scrapers can find.
This validates the guideline’s “stop as low as you can” stance and argues the simple
baseline (§0) should stay the loud default.
It also means our L3-heavy reference set (`tbd`) is the *exception*, and the guideline
should not read as if self-installing platforms are the norm.

* * *

### 2. The distribution channels, and when each is right

**Status**: ✅ Complete

Distinct, composable channels observed in the wild (a single public repo can satisfy
several at once):

| Channel | Mechanism | Best when | Seen in |
| --- | --- | --- | --- |
| **Repo-root `skills/<name>/SKILL.md`** | `npx skills add owner/repo` (skills.sh) scans it; scrapers index it | Always—the universal, zero-infra baseline | taste-skill, anthropics/skills, qmd |
| **Claude/Codex plugin marketplace** | `.claude-plugin/marketplace.json` (plus `.agents/plugins/...`); `/plugin marketplace add` | You want a *bundle* (skills, MCP, and hooks) installable as a unit, or in-Claude discovery | anthropics/skills, qmd, taste-skill |
| **Native per-agent skill dir** | Commit `.claude/skills/`, `.cursor/skills/`, `.github/skills/`, … | Targeting one agent that reads only its own dir (Claude Code) | All (Claude mirror) |
| **Self-installing CLI (`tool install`)** | Tool writes its own skill into discovery dirs | The skill ships *with* a binary and should track its version | qmd (L2), pprose (L2b), tbd (L3) |
| **Managed `AGENTS.md` block** | Marker-bounded, format-stamped block | You want an always-on bootstrap pointer that every agent reads | pprose (L2b), tbd (L3) |
| **Agent-specific instruction file** | `.github/copilot-instructions.md`, `GEMINI.md` | A target agent auto-reads a bespoke file | taste-skill (Copilot) |
| **`llms.txt` manifest** | Plain catalog of skills and one-line descriptions | Cheap machine-readable index for crawlers/agents | taste-skill |
| **MCP server** | `npx`/`uvx` server in marketplace or agent config | No CLI fits, or you need OAuth/multi-tenant/remote | qmd (alongside CLI) |

**Assessment**: The guideline covers most of these but frames the repo-root and
skills.sh path as one option among many.
The evidence says it is *the* default and everything else is additive.
Two channels are under-documented: agent-specific instruction files
(`copilot-instructions.md`) and `llms.txt`, both of which taste-skill uses to widen
reach at near-zero cost.

* * *

### 3. Case studies across the ladder

**Status**: ✅ Complete

- **taste-skill (L0, 13-skill collection)**—pure prompt skills, no binary.
  Distributed through *five* channels simultaneously: `npx skills add`, a Claude plugin
  marketplace (`.claude-plugin/marketplace.json` and `plugin.json`),
  `.github/copilot-instructions.md`, a `skills/llms.txt` manifest, and manual copy.
  **Versioning is by stable install-name, not format stamps**: the v2 rewrite keeps the
  same `name: design-taste-frontend` (so re-running `npx skills add` overwrites in
  place) and preserves v1 under a separate install-name `design-taste-frontend-v1` for
  callers that pinned to its behavior.
  No `format=fNN`, no `DO NOT EDIT`—none is needed, because nothing writes a managed
  file it must later migrate.
  The folder name and the frontmatter `name` deliberately differ (e.g.
  `brutalist-skill/` → `name: industrial-brutalist-ui`); the install-name is the
  contract.
- **anthropics/skills (L0 and bundled scripts)**—the official examples.
  Repo-root `skills/<name>/SKILL.md`, some with `scripts/` (xlsx,
  web-artifacts-builder).
  Primary distribution is a **Claude plugin marketplace** that groups the 18 skills into
  three plugins (`document-skills`, `example-skills`, `claude-api`). No self-installing
  CLI, no AGENTS.md. This is the canonical “skill collection as a plugin bundle” shape.
- **qmd (L2)**—Rust binary and embedded skills.
  Self-installs via `qmd skill install` (`--global`), writes discovery dirs only,
  **never** touches `AGENTS.md`. Ships a `.claude-plugin/marketplace.json` that points
  at `./skills/` *and* declares an MCP server.
  Its `SKILL.md` carries **no `format`/`DO NOT EDIT` stamp**—consistent with the
  guideline’s claim that an L2 discovery-dir installer is a clean overwrite that needs
  no migration apparatus.
  Offers dual project/global scope because it is a general-purpose utility with no
  per-project config.
- **pprose (L2b—the missing rung)**—Python CLI that self-installs into
  `.agents/skills/`, `.claude/skills/`, **and a marker-bounded `AGENTS.md` block**, with
  `format=f01` stamps and a forward-compat guard—but **no hooks, no `prime`/`setup`
  context machinery, no DocCache**. See §4.
- **tbd (L3)**—the full platform: managed `AGENTS.md` block, `SessionStart`/`PreCompact`
  hooks, `prime`/`setup`, format-versioned migration, knowledge-injection meta-skill
  over a path-ordered DocCache.
  Project-pinned, single-scope by design.

**Assessment**: Five real tools cleanly populate L0, L0+bundle, L2, L2b, and L3. The
ladder is a good model; its gap is that L2b is real and common enough to name.

* * *

### 4. The missing rung: L2b (self-install and managed `AGENTS.md`, no platform)

**Status**: ✅ Complete (issue #173 gap 1)

The guideline’s L2 stops at discovery dirs and “**no managed `AGENTS.md` block**”; L3
adds the block *plus* hooks, `prime`/`setup`, format migration, and a meta-skill.
pprose sits squarely between: it writes a ~13-line marker-bounded `AGENTS.md` block
alongside its skills, but has none of the L3 platform.
Its own AGENTS.md, verified:

```
<!-- BEGIN PPROSE INTEGRATION format=f01 -->
…compact bootstrap: what pprose is, when to use it, the pinned uvx runner…
<!-- END PPROSE INTEGRATION -->
```

A small always-on bootstrap block (the tool exists, here is its trigger, here is the
pinned fallback runner) is a worthwhile, low-cost lift that does not require the
platform.

**Assessment**: Name the rung.
Either split L2 into **L2a** (discovery-dirs only—`qmd`) and **L2b** (discovery-dirs and
managed `AGENTS.md` block—`pprose`), or add a named sentence acknowledging the rung.
The key correction is that **a managed `AGENTS.md` block is separable from the rest of
the L3 platform**—it is the *one* L3 surface a small tool can adopt on its own.

* * *

### 5. Format-versioning is artifact-driven, not rung-driven

**Status**: ✅ Complete (issue #173 gap 2)

The guideline currently scopes its `format=fNN` discipline to L3 ("The self-upgrade and
format-versioning rules in §6.6 apply **only to L3**"). The evidence contradicts the
sharpness of that line.
pprose, well short of L3, stamps `format=f01` on **both** its generated `SKILL.md` files
(`DO NOT EDIT: generated by pprose install (format=f01)`) and its `AGENTS.md` block, and
runs the **same forward-compat guard** tbd uses—refusing to clobber any artifact stamped
newer than it understands (`install.py` `_write_skill_file` returns `blocked-newer` when
`existing > _format_num()`; `_update_agents_md` does likewise on the begin-marker
stamp).

The distinguishing factor is not the ladder rung; it is **whether the tool writes a
generated artifact it may need to upgrade or refuse-to-clobber later**:

- taste-skill / qmd write skills they always overwrite whole and never migrate → **no
  stamp needed**.
- pprose writes a managed `AGENTS.md` block (merged into user content, not overwritten
  whole) and wants cross-version safety → **stamp needed**, despite being L2-ish.

**Assessment**: Reframe §6.6’s format-versioning as applying to **any rung that writes a
generated artifact it must upgrade or guard** (most concretely: a managed `AGENTS.md`
block, or any committed generated skill shared across tool versions).
The *hooks/`prime`/`setup`/DocCache* machinery is what stays L3-specific; the format
stamp is universal hygiene the moment a managed/merged artifact exists.

* * *

### 6. Dev-build generator pinning: what version does a dev checkout bake?

**Status**: ✅ Complete (issue #173 gap 3)

§6.7 is thorough on *pinned zero-install runners* but assumes the generator can pin to
its own running version.
A developer running `mytool install` from an editable/dev checkout has a running version
like `0.1.1.dev49+abc1234` that **was never published**, so
`uvx mytool@0.1.1.dev49+abc1234` cannot resolve.
Baking that pin ships a skill that fails the moment a teammate runs it—a single
works-on-my-machine install poisons the clone.

pprose solves this with two pieces, both verified in `install.py`:

- A `DISCOVERY_VERSION` constant—“the last real PyPI release”—used as the fallback pin
  when the running version is not publishable (`DISCOVERY_VERSION = "0.2.0"`, with a
  release-time guard `devtools/check_release_version.py` that fails publish unless it
  equals the release tag).
- `is_pypi_release(version_str)`—a PEP 440 release-form check
  (`^\d+(?:\.\d+)*(?:\.post\d+)?$`) that rejects dev (`.devN`), pre-release
  (`aN`/`bN`/`rcN`), and local (`+hash`) versions.
  `pinned_version()` returns the installed version when it is a real release, else
  `DISCOVERY_VERSION`.

**Assessment**: Worth a paragraph in §6.7. The rule generalizes across ecosystems:
**bake the running version only if it is a real, resolvable published release; otherwise
fall back to a known-good published pin.** npm has the same trap (`0.0.0-dev.<sha>` /
`x.y.z-canary` from `npm version`/CI never resolves on a teammate’s machine).
This is the inverse of the §6.7 consumer-side rule—it is the *generator-side*
pin-selection rule.

* * *

### 7. The `surface=` in-file tag is redundant

**Status**: ✅ Complete (issue #173 gap 4)

The guideline’s §2 and §6.6 examples show
`<!-- BEGIN MYCLI INTEGRATION format=f02 surface=agents-md -->`, but the surrounding
prose (§6.6, §6.6.2) argues the artifact’s identity is clear from its **location**, “so
no in-file `surface=` tag is needed beyond the load-bearing `format=fNN`.” The examples
and the reasoning contradict each other.

Field evidence resolves it.
In one real `AGENTS.md` (pprose’s repo, which hosts three tools’ blocks):

```
<!-- BEGIN PPROSE INTEGRATION format=f01 -->                       # no surface=
<!-- BEGIN TBD INTEGRATION format=f04 surface=agents-md -->        # has surface=
<!-- BEGIN FLOWMARK INTEGRATION format=f02 surface=agents-md -->   # has surface=
```

pprose deliberately **dropped** `surface=` (its install spec’s “One namespace for
surface” locked decision: the in-file marker carries only `format=fNN`; the artifact
type is identified by location, which also keeps the portable and Claude `SKILL.md`
copies byte-identical).
tbd (`setup.ts:167`) and flowmark still emit `surface=agents-md`.

**Assessment**: Drop `surface=` from the guideline examples to match the prose and the
cleaner reference. It is not load-bearing for detection—tbd’s own detection anchors on
the `BEGIN TBD INTEGRATION` prefix and reads `format=fNN`; `surface=agents-md` is
decorative. **Implication for tbd itself**: tbd’s generator emits a tag the guideline
would now call unnecessary.
Dropping it from tbd is a safe, tiny follow-on (the block is always rewritten whole and
detection ignores the field), but it is a *generator* change, not a guideline change,
and can be tracked separately.

* * *

### 8. Multi-block collapse: stale blocks accumulate across marker renames

**Status**: ✅ Complete (issue #173 gap 5)

The guideline covers “`AGENTS.md` exists without your markers → append, preserve user
content” but is silent on **multiple stale blocks**—e.g. a tool that shipped
`BEGIN PPROSE BLOCK` in v0.0.x and switched to `BEGIN PPROSE INTEGRATION` in v0.1.x
leaves users with both until upgraded.
pprose’s `_update_agents_md` (`install.py` L401–433) handles it: find every match of the
begin/end regex, replace **all** of them with one current block at the position of the
**first** stale block, discard the rest, and preserve everything outside the markers.

**Assessment**: Worth a sentence in §2 or §6.6: on install, collapse all matching
managed blocks to a single current block at the first match’s position.
Note the practical caveat the issue does not: collapse only works for blocks that still
share the stable begin-prefix; a *renamed* prefix (`BLOCK` → `INTEGRATION`) needs the
installer to match a small set of known legacy prefixes, not just the current one.
This is the same “keep the marker name stable / match on prefix” rule the guideline
already states for `format=`, extended to prefix renames.

* * *

### 9. Current-practice corrections (ecosystem moved since last update)

**Status**: ⏳ Verify per-agent before asserting in the guideline

- **Cursor now scans `.agents/skills/` natively.** Per Cursor’s mid-2026 Agent Skills
  docs, Cursor auto-discovers skills from `.agents/skills/`, `.cursor/skills/`,
  `~/.agents/skills/`, and `~/.cursor/skills/` (including nested monorepo dirs).
  The guideline currently states Cursor reaches `.agents/skills/` “via the skills.sh
  installer … not natively”—that is now **stale** for Cursor.
  (Re-verify against current Cursor docs before editing, per the guideline’s own “verify
  native scanning” rule.)
- **Native per-agent skill directories are proliferating.** Community catalogs
  (VoltAgent) report native project/global skill dirs across agents: Claude
  `.claude/skills/`, Codex `.agents/skills/`, Cursor `.cursor/skills/`, Copilot
  `.github/skills/`, Gemini `.gemini/skills/`, OpenCode `.opencode/skills/`, Windsurf
  `.windsurf/skills/`, plus Google’s new **Antigravity** (`.agent/skills/`). Treat as
  directional (community-sourced) and verify per agent, but the trend is real: the
  ecosystem is growing per-agent native dirs *in addition to* the portable
  `.agents/skills/`, which raises the value of the `npx skills add` symlink-fan-out and
  of a tool emitting only the portable and Claude surfaces and letting the installer
  mirror the rest.

**Assessment**: The “who reads `.agents/skills/` natively vs via the installer” table in
§6.6 needs a refresh, with Cursor moved to native (pending re-verification) and a note
that native per-agent dirs are multiplying.

* * *

## Comparative Analysis: The Distribution Decision Matrix

| If your tool is… | Distribute via | Format stamp? | Scope |
| --- | --- | --- | --- |
| **Prompt-only (L0)** | repo-root `skills/` and `npx skills add` (plus a plugin marketplace for a bundle, and `copilot-instructions.md` or `llms.txt` for extra reach) | No | n/a |
| **Prompt-only collection needing versions** | same, **version by stable install-name**; keep old names alive for pinned callers (taste-skill) | No | n/a |
| **Skill that points at a CLI (L1)** | repo-root `skills/` whose body uses a **pinned** `npx`/`uvx pkg@ver` runner | No | n/a |
| **CLI that self-installs, discovery dirs only (L2)** | `tool install [--global]`, overwrite skills; optional plugin marketplace and MCP (qmd) | Optional (clean overwrite) | dual if general-purpose |
| **CLI that self-installs and managed `AGENTS.md` block (L2b)** | as L2 **plus** a marker-bounded, **format-stamped** `AGENTS.md` block with a forward-compat guard and multi-block collapse (pprose) | **Yes** (the block is merged, not overwritten) | usually project |
| **Full platform (L3)** | L2b plus hooks, `prime`/`setup`, the meta-skill and DocCache, and format migration (tbd) | **Yes** (shared format code across surfaces) | project-pinned, single-scope |
| **No CLI, or OAuth/multi-tenant/remote** | MCP server (optionally bundled in a plugin marketplace) | n/a | per server |

**Strengths/weaknesses**:

- **repo-root and skills.sh**: maximum reach, zero infra, no version control over the
  consumer—the right default and what the leaderboard rewards.
- **plugin marketplace**: best versioning (SHA pin, install preview, bundles MCP and hooks);
  costs a manifest and is not centrally indexed unless you also list on the community
  marketplace.
- **self-installing CLI**: tracks the binary’s version and customizes per project; only
  worth it once the skill genuinely ships with a tool.
- **managed `AGENTS.md` block**: an always-on bootstrap pointer for *every* agent; the
  one L3 surface adoptable alone, but the moment you write it you owe format stamping +
  collapse and a forward-compat guard.

* * *

## Best Practices (Distilled)

1. **Default to the simple baseline.** A spec-compliant repo-root
   `skills/<name>/SKILL.md` plus `npx skills add` is what the most-installed skills do.
   Stop there unless a binary or cross-session state forces you up the ladder.
2. **Version L0 collections by stable install-name**, not format stamps; keep superseded
   names alive for callers who pinned to old behavior (taste-skill).
3. **Stamp `format=fNN` the moment you write a managed/merged artifact** (an `AGENTS.md`
   block, or a committed generated skill shared across tool versions)—independent of
   ladder rung—and pair it with a forward-compat guard.
4. **Pin generator-baked versions to a publishable release.** Never bake a
   dev/pre-release/ local version into a generated skill; fall back to a known-good
   published pin and guard it at release time.
5. **Identify artifacts by location, not in-file tags.** Carry only `format=fNN` in
   markers; skip `surface=`. Keep portable and Claude `SKILL.md` copies byte-identical.
6. **Collapse stale managed blocks on install** to one current block at the first match,
   matching a small set of known legacy begin-prefixes, preserving user content outside
   the markers.
7. **Widen reach cheaply** with additive channels (plugin marketplace bundle,
   `copilot-instructions.md`, `llms.txt`) without changing the canonical skill.

* * *

## Recommendations

### Summary

Fold the eight findings above into `cli-agent-skill-patterns` as targeted edits (mapped
gap-by-gap in
[plan-2026-06-13-cli-skill-guideline-pprose-gaps.md](../../specs/active/plan-2026-06-13-cli-skill-guideline-pprose-gaps.md)),
keep the simple baseline loud, and refresh the stale Cursor/native-dir facts.
Track the tbd-generator `surface=` cleanup (finding 7) as a separate small bead.

### Recommended Approach

Surgical edits, not a rewrite: name L2b (gap 1), reframe format-versioning as
artifact-driven (gap 2), add the generator-side dev-build pin rule to §6.7 (gap 3), drop
`surface=` from examples (gap 4), add multi-block collapse to §2/§6.6 (gap 5), and
update the §6.6 native-scanning table (finding 9). Each tagged with its ladder rung so
§0 stays untouched.

### Alternative Approaches

If splitting L2 into L2a/L2b feels heavy, a single named sentence ("L2 may optionally
add a managed `AGENTS.md` block—the one L3 surface adoptable without the platform;
`pprose` is the reference") captures 80% of the value with no renumbering.

* * *

## References

- Issue: https://github.com/jlevy/tbd/issues/173
- pprose install source (verified):
  `attic/practical-prose/tools/pprose/src/pprose/install.py` (`DISCOVERY_VERSION` L56,
  `is_pypi_release` L96, `pinned_version` L101–112, `_update_agents_md` collapse
  L401–433, forward-compat guards L391–393 / L409–411)
- pprose install spec: `plan-2026-05-30-pprose-install-scopes-and-surfaces.md` (pprose
  repo)—“One namespace for surface” locked decision
- taste-skill: https://github.com/Leonxlnx/taste-skill (skills.sh, a plugin marketplace,
  copilot-instructions, and llms.txt; install-name versioning)
- qmd: https://github.com/tobi/qmd (L2 reference)
- anthropics/skills: https://github.com/anthropics/skills (plugin-bundle reference)
- skills.sh leaderboard: https://skills.sh
- catalogs: https://github.com/VoltAgent/awesome-agent-skills,
  https://github.com/heilcheng/awesome-agent-skills
- Cursor Agent Skills docs (native `.agents/skills/` discovery; mid-2026)

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
