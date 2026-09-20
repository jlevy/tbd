---
type: is
id: is-01m2ypbaqtxkwhjf65rt9dyyfb
title: Make watch CLI deadline failures diagnosable and deterministic in tests
kind: bug
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
parent_id: is-01kjcb7j040avaqy7d8n2m9gbj
created_at: 2026-09-20T05:59:11.865Z
updated_at: 2026-09-20T05:59:11.865Z
---
PR #316 local validation: cli-watch.test.ts immediate --since report returned exit 1 instead of 0 with --timeout 1 under concurrent load. The assertion hides stderr and cannot distinguish a Git fetch deadline from another error. Preserve stdout/stderr in failure evidence, isolate the failure, and separate successful-report correctness from deadline behavior. Acceptance: immediate-report and timeout contracts pass repeatably without weakening exit semantics.
