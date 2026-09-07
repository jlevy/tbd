---
type: is
id: is-01m1yzx57t4174xcg4fydgqrw9
title: "policy.outbound.deep: flatten (opt-in) mirrors deep beads as top-level tracker issues"
kind: feature
status: open
priority: 3
version: 2
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-1
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:31.413Z
updated_at: 2026-09-07T22:31:40.827Z
---
GH #272 option. policy.outbound.deep: skip | flatten, default skip. Under flatten a bead past max_nesting is mirrored as a top-level tracker issue with 'Parent: <display id> <title>' in the managed block and no provider parent. Already-linked deep beads are mirrored exactly this way today (mirror.ts:240-272, parentId omitted), so flatten generalizes existing behavior. The 2026-08-10 spec's stance 'deeper structure stays in beads' (plan-2026-08-10-external-tracker-integrations.md:839-843) remains the default. Pending the plan's open question.
