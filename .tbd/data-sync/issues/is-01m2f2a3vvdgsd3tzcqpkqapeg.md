---
type: is
id: is-01m2f2a3vvdgsd3tzcqpkqapeg
title: "Docs-config-redesign spec exists only on PR #117's branch; 43 open beads point at a path absent from main"
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-09-14T04:20:24.059Z
updated_at: 2026-09-14T04:20:24.059Z
---
`docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md` is not on `main`. Its only commit is 359a2d1e on `origin/claude/review-config-format-2wxh8` (PR #117, still a draft from May). 44 beads carry it as `spec_path`, 43 of them open, including four epics: 'Spec: Docs config redesign (f06+ framework)', 'Phase 1: Basic capabilities and migration', 'Phase 2: External bundles and override roundtrip', and 'Phase 3: Migrate bundled docs to external repo (tbd-docs)'.

Consequence for the reconciliation pass: every one of those epics reads as MISSING spec in the update-specs-status triage, so the mechanical repair in that shortcut cannot touch them (no same-named file in any lifecycle folder) and a naive pass would refile a live 43-bead workstream as a draft. This is the same on-branch case #278 had with 92 beads, but #117 has been open far longer.

Also blocks a second thing: `tbd update --spec` validates the path against the current checkout (#273), so these beads cannot be repointed or re-created with their spec from main at all. Hit live during the 2026-09-14 pass — restoring one mis-set `spec_path` to an on-branch spec required checking the file out of the branch, running the update, and deleting it again.

Decide: land or close #117, or move the spec to main on its own (docs-only) so the 43 beads have a governing document that exists. Until then, record the on-branch state in TODO.md so the next pass does not misfile it.
