---
type: is
id: is-01m2kfdwg1v0yk4zt6zrz7h6eq
title: "Stability sprint plan text is stale after #286-#290; record the 2026-09-15 release gates"
kind: task
status: open
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels: []
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-15T21:26:36.800Z
updated_at: 2026-09-16T08:28:40.524Z
extensions:
  linear:
    id: 6086b533-e680-4064-9a8f-9008d1f7eab9
    linked_at: 2026-09-16T08:28:40.524Z
---
The stability sprint plan (docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md) is stale after #286-#290 (found by the 2026-09-15 release-readiness review of main @ 1238038e):
- Status block (~:13-18) omits #286-#290; the #290 note (~:19) does not mention the new `--push` and mixed-version contention.
- ~:41-50 says tbd-s3zx is unfixed and blocks Release 1; it was fixed in 87cd7619 (#287).
- ~:466-474 and ~:664-667 say `tbd sync` writes no attic entries; fixed in 413d7e69 (#288).
- The Stage B gate list (~:672-700) omits tbd-dmkd and tbd-0oz8, and its contents list stops at #280.
- Phase 0 marks T1, T2 and T4 done (their beads are now closed); record the Release 1 gates filed on 2026-09-15, and qualify "no release before 1a": after #290 it still applies to mixed-version teams, `--push` users, and teams whose Backlog state does not resolve.
- 22 open beads still point at plan-2026-08-28-sync-convergence-and-stability.md, which exists only on the unmerged branch (tbd-bdkj).

Docs-only; keep line references current and run flowmark.
