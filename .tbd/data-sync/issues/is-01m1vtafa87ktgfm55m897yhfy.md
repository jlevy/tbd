---
type: is
id: is-01m1vtafa87ktgfm55m897yhfy
title: Preserve independent pending comments through workspace and outbox recovery
kind: bug
status: closed
priority: 1
version: 6
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: codex-stability-recovery
labels: []
dependencies: []
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
created_at: 2026-09-06T16:55:12.967Z
updated_at: 2026-09-08T23:38:36.273Z
closed_at: 2026-09-08T23:29:49.035Z
close_reason: "Implemented and validated in PR #279: append-only comments survive workspace save/import and automatic outbox recovery, including secondary-push failure and retry."
resolution: null
duplicate_of: null
---
The 2026-09-06 coordination review reproduced pending-comment loss through production saveToWorkspace and importFromWorkspace APIs. Seed a shared base comment, then older version-2 [base,A] and newer version-2 [base,B] with distinct local IDs and ordered updated_at. Saving newer into older workspace and importing older outbox into newer data both retain only [base,B], report zero conflicts and empty attic. Direct outbox import clears the source containing A. Automatic sync has different clearing timing but shares the merge path. file/workspace.ts:345/471 treats an older current snapshot as the ancestor, bypassing union. Fix without regressing sequential field updates; cover independent comments, both time orders/equal time, save/import/outbox and archived lost values. Related historical closed tbd-p1lz/tbd-hg05. Research: docs/project/research/current/research-2026-09-06-bead-agent-coordination.md.

## Notes

Incremental landing slice 1 on codex/stability-comment-recovery, targeting main independently of plan PR #278. Implemented a base-independent append-only comment postcondition in packages/tbd/src/file/git.ts mergeIssues via preserveExtensionComments/preserveNamespaceComments; workspace save/import keep their existing scalar LWW heuristics. Regression coverage: packages/tbd/tests/workspace.test.ts covers newer save, older direct outbox import and clear, equal timestamps with empty attic, and sequential append without version churn. packages/tbd/tests/outbox-comment-recovery.integration.test.ts drives the built CLI against a bare Git remote, forces the secondary recovery push to fail, proves the outbox remains, then retries and proves both comments reach the remote before clear. Precommit senior review found no blocking issues; the central merge boundary is preferred over duplicating policy in saveToWorkspace/importFromWorkspace. Validation after the final failure-injection refinement: formatter, Flowmark, typecheck, ESLint, action-pin check, build, and full repository suite passed with 166 test files and 2,485 tests; all GitHub OS/runtime test jobs pass. PR #279's sole red job is the newly published js-yaml advisory recorded in tbd-r82u.
