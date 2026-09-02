---
type: is
id: is-01m0y1rd4ss2xf3ynha9xgkca7
title: Review README, skill surfaces, and guideline group routing
kind: task
status: closed
priority: 2
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01m0y1rep9djp2ds5g7jyz71zj
parent_id: is-01m0y1gprchhzvxegj8atrwsj8
created_at: 2026-08-26T03:27:56.569Z
updated_at: 2026-08-26T03:53:57.971Z
closed_at: 2026-08-26T03:53:57.971Z
close_reason: Reviewed. Count confirmed at 43, so '40+' holds. Three README cells misdescribed their document, worst being general-coding-rules (claimed four topics; the document has two sections). tbd-sync-troubleshooting was in no table. Cross-cutting group note was 193 chars against an ~88-col constraint and duplicated the table below it. Agent surfaces regenerated.
resolution: null
duplicate_of: null
---
Review the user-facing and generated surfaces changed in this PR:
`README.md` §Built-in Engineering Knowledge (one table split into six),
`packages/tbd/docs/shortcuts/system/skill-baseline.md`, `skill-minimal.md`,
`packages/tbd/docs/install/claude-header.md`, the guideline-group headings and notes in
`packages/tbd/src/file/doc-cache.ts`, and the regenerated skill surfaces
(`.claude/skills/tbd/SKILL.md`, `.agents/skills/tbd/SKILL.md`, `skills/tbd/SKILL.md`).
Scope rules are in the parent epic—read it first (`tbd show tbd-81x8`).

## Factual claims to verify

- **“40+ guideline documents”** in the README, `skill-baseline`, and `skill-minimal`.
  Count the actual bundled files and confirm the claim; it was “25+” before.
- **Every README table row.** The “What it covers” cell must match the document’s own
  frontmatter `description` and contents. These were rewritten wholesale, so treat each
  as an unverified claim, and check every link path resolves.
- Every document in `packages/tbd/docs/guidelines/` appears in exactly one README
  section, and no row names a document that does not exist.
- The three generated `SKILL.md` copies are byte-identical where they should be, and
  regenerating them produces no diff.

## Consistency

The three-layer loading instruction (always-load core, language documents by surface,
cross-cutting topics by surface) is stated in `skill-baseline.md` and again as the group
notes in `doc-cache.ts`. Confirm they agree with each other and with the README, and that
the group notes are within the ~88-column constraint the surrounding comment requires.

## Brevity

The always-load budget is the point of this change (2,233 lines down to 909, asserted by
`guideline-budget.test.ts`). Check that what remains always-loaded earns its place and
that the group notes are as short as they can be while still routing correctly.
