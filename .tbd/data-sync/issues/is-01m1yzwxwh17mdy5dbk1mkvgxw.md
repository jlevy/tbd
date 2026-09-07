---
type: is
id: is-01m1yzwxwh17mdy5dbk1mkvgxw
title: One tracker report renderer for tbd sync and tbd integration sync
kind: task
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-1
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:23.888Z
updated_at: 2026-09-07T22:31:40.760Z
---
Three printers with three vocabularies today: printSyncReport (integration.ts:540-586, 'skipped' never takes 'would'), the mirror printer (integration.ts:437-476), and the fold in tbd sync (sync.ts:353-394, omits skipped entirely; on the stability branch it prints pushed/pulled/created, conflicts, failures). Replace with one function rendering a SyncRunReport, parameterized by tense and invoking command: 'linear: push 3, pull 1, create 2 | excluded 6 (past max_nesting 2) | failed 1', then capped detail lines (10 per class, --verbose for all). excluded and failed never take 'would'. Also tally the fold's own commit into the git summary so 'Already in sync' cannot follow a fold that wrote (see the sibling bead).
