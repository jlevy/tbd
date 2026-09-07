---
type: is
id: is-01m1yzx9f2zd6gpjwkmszgkbb3
title: tbd sync prints 'Already in sync' after a fold that wrote
kind: bug
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-1
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:35.744Z
updated_at: 2026-09-07T22:31:40.888Z
---
GH #265 symptom 1, second half. summary.sent is filled only by commitWorktreeChanges in STEP 1 (sync.ts:1116-1119), before the fold; the fold's own 'tbd integration: sync' commit (end of runEnabledIntegrations, integration-runner.ts) is never tallied, so formatSyncSummary returns empty and sync.ts:1384-1391 prints 'Already in sync' after 13 beads and 13 bridge records were written and pushed. Tally the fold's commit into summary.sent. Tryscript case in tests/cli-sync-surface-honesty.tryscript.md.
