---
title: cli-agent-skill-patterns—Five pprose-Surfaced Gaps (issue #173)
description: Plan to fold the five small gaps from issue #173 (surfaced by the pprose L2-ish CLI) into the cli-agent-skill-patterns guideline, plus the ecosystem current-practice corrections from the mid-2026 distribution audit
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Feature: cli-agent-skill-patterns—Five pprose-Surfaced Gaps (issue #173)

**Date:** 2026-06-13

**Status:** Implemented—guideline edits applied and under review in
[PR #175](https://github.com/jlevy/tbd/pull/175). The decisions below are settled (see
the resolved Open Questions); this spec is a record, not an open proposal.

## Overview

[Issue #173](https://github.com/jlevy/tbd/issues/173) re-reads
`cli-agent-skill-patterns` against
[`pprose`](https://github.com/jlevy/practical-prose)—a Python CLI that self-installs
into `.agents/skills/`, `.claude/skills/`, and a marker-bounded `AGENTS.md` block—and
surfaces five small, self-contained gaps.
All five were verified against pprose’s working `install.py` (file:line cites in the
research brief). The verdict in the issue is correct: the guideline is in great shape;
these are precision fixes, not a rewrite.

This plan maps each gap to a concrete edit, tagged with the ladder rung it touches so
the simple baseline (§0) stays untouched, and adds the ecosystem current-practice
corrections from the wider distribution audit.
Evidence:
[research-2026-06-13-skill-distribution-landscape.md](../../research/current/research-2026-06-13-skill-distribution-landscape.md).

Canonical edit target:
[packages/tbd/docs/guidelines/cli-agent-skill-patterns.md](../../../../packages/tbd/docs/guidelines/cli-agent-skill-patterns.md)
(ships via `tbd guidelines`). The `.tbd/docs/` copy is a regenerated cache—never edit it
directly.

## Goals

- Fold the five issue #173 gaps into the guideline as surgical, evidenced edits.
- Resolve the guideline’s one internal contradiction (examples emit `surface=`; prose
  says it is unneeded).
- Refresh stale ecosystem facts (Cursor native `.agents/skills/` discovery; native
  per-agent skill dirs).
- Keep the guideline non-dogmatic and ladder-shaped: every addition states its rung.

## Non-Goals

- Rewriting the guideline or its §0 baseline.
- Changing tbd runtime behavior, except to track the small `surface=` generator cleanup
  (gap 4) as a *separate* follow-on bead, not part of this doc edit.
- Re-litigating the Clerk/Render/Convex edits already planned in
  `plan-2026-06-03-tbd-agent-cli-guideline-improvements.md` (independent; can land in
  the same editing pass).

## Background

The guideline was shaped mainly by `tbd` (L3) and `qmd` (L2). pprose is the first
well-built **L2b** reference in our evidence base—self-install and a managed `AGENTS.md`
block, but no hooks/`prime`/`setup`/DocCache—and it exercises exactly the seams the
guideline draws too sharply at the L2/L3 boundary.
Separately, the wider audit (skills.sh leaderboard, vendor catalogs, taste-skill,
anthropics/skills) confirms the simple baseline is the dominant real-world pattern and
surfaces two stale facts.

## Design: The Five Gaps and Their Edits

### Gap 1—Name the rung between L2 and L3 (§6.0)

**Finding**: pprose writes a compact managed `AGENTS.md` block but none of the L3
platform.
The ladder forces such tools to either drop the block (L2) or appear to take on
the whole L3 burden.

**Edit** (rung: L2/L3 boundary): in §6.0, either split L2 into **L2a** (discovery-dirs
only—`qmd`) and **L2b** (discovery-dirs and managed `AGENTS.md` block—`pprose`), keeping
L3 (`tbd`) as-is; **or** add one named sentence: “L2 may optionally add a managed
`AGENTS.md` block—the one L3 surface adoptable without the rest of the platform; pprose
is the reference.” Recommended: the single-sentence acknowledgment first (no
renumbering), upgraded to a full L2a/L2b split only if the §0.3 decision guide and the
§6.0 prose read cleanly with it.
Add pprose to the worked-examples set wherever `qmd`/`tbd` are cited.

### Gap 2—Format-versioning is artifact-driven, not L3-only (§6.0, §6.6)

**Finding**: pprose (sub-L3) stamps `format=f01` on its `SKILL.md` files *and* its
`AGENTS.md` block and runs the same forward-compat guard.
The distinguishing factor is whether a tool writes a generated artifact it must
upgrade/guard, not its rung.

**Edit** (rung: any rung that writes a managed/merged artifact): soften the §6.0 closer
("§6.6 applies **only to L3**") and reframe §6.6’s “Upgrade existing installs
deliberately (L3 only)” as **“any rung that writes a generated artifact it may need to
upgrade or refuse-to-clobber”**—most concretely a managed `AGENTS.md` block or a
committed generated skill shared across tool versions.
Keep the *hooks/`prime`/`setup`/DocCache* machinery explicitly L3-specific.
State the test: overwrite-whole-and-never-migrate (taste-skill, qmd) needs no stamp;
merged-or-shared-and-guarded (pprose) does.

### Gap 3—Generator-side dev-build pin selection (§6.7)

**Finding**: §6.7 covers consumer-side pinned runners but assumes the generator can pin
to its own running version.
A dev/editable checkout reports an unpublishable version (`0.1.1.dev49+abc1234`) that
`uvx pkg@<that>` cannot resolve, so the baked pin ships a broken skill.

**Edit** (rung: any self-installer that bakes a pin, L1+): add one paragraph to §6.7:
bake the running version only if it is a **real, resolvable published release**;
otherwise fall back to a known-good published constant (pprose’s `DISCOVERY_VERSION`,
gated by a PEP 440 release check `is_pypi_release` and a release-time guard).
Note the npm analog (`0.0.0-dev.<sha>`/`-canary` from CI). Frame it as the inverse of
the existing consumer-side rule: the generator-side pin-selection rule.

### Gap 4—Drop the redundant `surface=` in-file tag (§2, §6.6)

**Finding**: §2 (line ~206) and §6.6 (line ~697) examples show
`format=f02 surface=agents-md`, but §6.6/§6.6.2 prose says the artifact’s identity is
its location, “so no in-file `surface=` tag is needed.”
pprose dropped `surface=` deliberately; tbd (`setup.ts:167`) and flowmark still emit it.
It is not load-bearing for detection.

**Edit** (rung: any tool with a managed `AGENTS.md` block): drop `surface=agents-md`
from both examples so they carry only `format=fNN`, matching the prose and the cleaner
reference. Add one sentence: `surface=` is optional and decorative—detection anchors on
the stable begin-prefix and reads `format=fNN`; identify artifacts by location, which
also keeps portable and Claude `SKILL.md` copies byte-identical.

**tbd-code implication (separate bead, not this edit)**: tbd’s generator emits a tag the
guideline would now call unnecessary.
Dropping it from tbd is safe (block is rewritten whole; detection ignores the field) but
is a generator change.
File a small follow-on bead; do not block the guideline edit on it.

### Gap 5—Collapse multiple stale managed blocks (§2 or §6.6)

**Finding**: the guideline covers “no marker block yet → append” but not **multiple
stale blocks** (e.g. a begin-prefix rename across versions leaves two).
pprose’s `_update_agents_md` replaces all matches with one current block at the first
match’s position, preserving content outside markers.

**Edit** (rung: any tool with a managed `AGENTS.md` block): add a sentence—on install,
collapse all matching managed blocks to a single current block at the first match’s
position. Extend the existing “keep the begin/end marker names stable / match on prefix”
rule to cover prefix *renames*: match a small set of known legacy begin-prefixes, not
just the current one (collapse only works if the installer recognizes the old prefix).

### Ecosystem current-practice corrections (§6.6 native-scanning table)

(Rung: reference material, all rungs.)
From the wider audit:

- **Cursor now scans `.agents/skills/` natively** (Cursor mid-2026 docs:
  `.agents/skills/`, `.cursor/skills/`, and `~/` variants).
  The guideline currently lists Cursor as reached “via the skills.sh installer … not
  natively”—move it to native.
  **Re-verify against current Cursor docs before editing**, per the guideline’s own
  rule.
- **Native per-agent skill dirs are proliferating** (Claude `.claude/skills/`, Cursor
  `.cursor/skills/`, Copilot `.github/skills/`, Gemini `.gemini/skills/`, OpenCode
  `.opencode/skills/`, Windsurf `.windsurf/skills/`, Google Antigravity
  `.agent/skills/`). Add a directional note (community-sourced; verify per agent) that
  the ecosystem is growing per-agent native dirs alongside portable `.agents/skills/`,
  which raises the value of letting the `npx skills add` installer fan out the mirrors.

### §11 / §12 updates

Reflect gaps 1–5 as new bullets/checklist items, each tagged with its rung.
Refresh the “Last Updated” line and add pprose (and, where useful,
taste-skill/anthropics-skills) to the worked-examples and References lists.

## Implementation Plan

### Phase 1—Guideline edits (done; owner chose the single named-variant form for gap 1)

- [x] §6.0: name **L2b** as a single named variant within L2 (no L2a/L2b renumber)—the
  owner chose the lighter form over a full ladder split.
- [x] §6.0 and §6.6: reframe format-versioning as artifact-driven, not L3-only; keep
  hooks/`prime`/`setup`/DocCache L3-specific.
- [x] §6.7: add the generator-side dev-build pin-selection paragraph (DISCOVERY_VERSION
  / is_pypi_release, with the npm analog).
- [x] §2 and §6.6: drop `surface=agents-md` from both examples; add the one-sentence
  “identify by location” note.
- [x] §2 or §6.6: add the multi-block-collapse sentence and the legacy-prefix-rename
  note.
- [x] §6.6 native-scanning table: move Cursor to native (re-verified); add the
  per-agent-native-dirs directional note.
- [x] §11 Summary and §12 Checklist: new bullets, each tagged with its rung; refresh
  “Last Updated”; add pprose to worked examples/References.
- [x] Format with flowmark (never Prettier); unspaced em dashes; keep the doc footer;
  check all internal cross-references resolve.

### Phase 2—Follow-on (separate beads)

- [ ] Bead: drop `surface=agents-md` from tbd’s generated `AGENTS.md` begin line
  (`setup.ts`), keeping detection prefix-anchored; emit the cleaner marker going
  forward, accept old `surface=...` markers, collapse duplicates, and guard newer
  `format=fNN` blocks; update goldens/drift tests.
- [ ] Optional: have tbd’s generated artifacts demonstrate any newly recommended
  pattern, so the reference implementation stays ahead of the guideline.

From the [PR #175](https://github.com/jlevy/tbd/pull/175) senior review (dogfooding
roadmap—tracked here, intentionally not in this pure-docs PR):

- [ ] Make tbd’s distribution contract explicit (docs): state that tbd is intentionally
  L3, not the baseline for ordinary CLIs; list the surfaces tbd owns (generated skills,
  managed `AGENTS.md` block, hooks, setup/prime, DocCache/meta-skill); name which lower
  rungs simpler tools should prefer and why.
- [ ] Generate and test tbd’s canonical skill from one source: ensure repo-local
  `.agents/skills/tbd/SKILL.md` and the `.claude/skills/tbd/` mirror come from a single
  source of truth, keep the drift test, and keep the skill small (route to `tbd prime`,
  `tbd shortcut`, `tbd guidelines`—don’t embed the manual).
- [ ] Make format migration artifact-driven in code and tests: test the managed
  `AGENTS.md` block independently from hook and skill files; treat each generated
  artifact as having its own format/migration contract; don’t imply stamps exist only
  because a tool is L3.
- [ ] Improve `tbd setup`/`doctor` output around rungs and surfaces: explain which
  surfaces are installed and why tbd is L3, and reinforce that simpler tools usually
  want L1, plain L2, or the L2b variant.

## Testing Strategy

Documentation change—review-based.
Re-read end-to-end: every new rule states its rung; nothing contradicts §0; the
`surface=` example/prose contradiction is gone.
Confirm each claim maps to a real, cited example (the research brief is the evidence
index). Confirm cross-references resolve and flowmark is a no-op.

## Open Questions (resolved)

1. **L2a/L2b split vs single sentence (gap 1)**—RESOLVED: the owner chose the single
   named sentence. L2b is named as a variant within L2; the four-rung ladder (L0–L3) is
   unchanged, with no L2a/L2b renumber.
2. **tbd `surface=` cleanup (gap 4)**—RESOLVED: tracked as a Phase 2 follow-on; the
   guideline edit stays pure-docs.
3. **Cursor native-scanning**—RESOLVED: verified against current Cursor docs before
   asserting native `.agents/skills/` scanning in §6.6.

## References

- Issue: https://github.com/jlevy/tbd/issues/173
- Evidence:
  [research-2026-06-13-skill-distribution-landscape.md](../../research/current/research-2026-06-13-skill-distribution-landscape.md)
- Guideline:
  [packages/tbd/docs/guidelines/cli-agent-skill-patterns.md](../../../../packages/tbd/docs/guidelines/cli-agent-skill-patterns.md)
- Related plan: `plan-2026-06-03-tbd-agent-cli-guideline-improvements.md` (Clerk/Render/
  Convex; independent, can co-land)

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
