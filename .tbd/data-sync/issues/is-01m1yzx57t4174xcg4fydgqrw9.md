---
type: is
id: is-01m1yzx57t4174xcg4fydgqrw9
title: "policy.outbound.deep: flatten (opt-in) mirrors deep beads as top-level tracker issues"
kind: feature
status: open
priority: 3
version: 3
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-1
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:31.413Z
updated_at: 2026-09-14T02:58:46.563Z
---
GH #272 option. policy.outbound.deep: skip | flatten, default skip. Under flatten a bead past max_nesting is mirrored as a top-level tracker issue with 'Parent: <display id> <title>' in the managed block and no provider parent. Already-linked deep beads are mirrored exactly this way today (mirror.ts:240-272, parentId omitted), so flatten generalizes existing behavior. The 2026-08-10 spec's stance 'deeper structure stays in beads' (plan-2026-08-10-external-tracker-integrations.md:839-843) remains the default. Pending the plan's open question.

f08 compatibility review 2026-09-14 (see 'f08 Compatibility Contract for Sprint Fixes' in the stability sprint plan): BEHAVIOR CONFLICT. flatten is safe on disk (0.8.1 keeps policy.outbound.deep; it needs an inline policy object, not policy: default) but every 0.7.x/0.8.x sync re-sets the Linear parent of a linked bead whose parent is linked (sync-engine.ts:850-860, same in v0.8.1 and v0.7.0), re-nesting what flatten flattened on each run. The plan's claim that linked deep beads already mirror parentless holds only for the old --push path. Ship only with a stated minimum version for every writer, after tbd-s4kb (T3) covers it.
