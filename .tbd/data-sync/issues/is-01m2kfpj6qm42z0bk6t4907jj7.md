---
type: is
id: is-01m2kfpj6qm42z0bk6t4907jj7
title: "packages/tbd/.claude/skills/tbd/SKILL.md never says beads live on tbd-sync (residue of #238)"
kind: chore
status: open
priority: 3
version: 3
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels: []
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-15T21:31:21.175Z
updated_at: 2026-09-16T08:28:43.510Z
extensions:
  linear:
    id: 3bc6d32d-9172-49bb-907b-c0b2f568efd3
    linked_at: 2026-09-16T08:28:43.510Z
---
Residue of GitHub #238 (closed 2026-09-15; the generated skills were fixed in a1a2a634 and shipped in 0.8.1). `packages/tbd/.claude/skills/tbd/SKILL.md` is committed and loaded by agents working inside the package directory, but it is not generated from `packages/tbd/docs/shortcuts/system/skill-baseline.md` and never mentions `tbd-sync` (0 matches on main @ 1238038e), while the generated `.claude/skills/tbd/SKILL.md` and `.agents/skills/tbd/SKILL.md` carry the "Where beads live" note (skill-baseline.md:154-165).

Either regenerate that copy from the baseline or remove it if it is obsolete, and pin whichever choice with a test so the two cannot drift again. Noted in the stability sprint plan, Phase 5d.
