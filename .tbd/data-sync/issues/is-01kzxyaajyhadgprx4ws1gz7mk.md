---
type: is
id: is-01kzxyaajyhadgprx4ws1gz7mk
title: Report planned comment work accurately in integration dry-runs
kind: bug
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - linear
  - integration
  - comments
dependencies: []
parent_id: is-01kzxy6ks7pd36nnzrppfdspq6
created_at: 2026-08-13T16:12:07.645Z
updated_at: 2026-08-13T16:12:10.123Z
extensions:
  linear:
    id: 530ad79d-73ce-485b-9700-b2f14295ce87
    linked_at: 2026-08-13T16:12:10.123Z
---
Dry-run leaves commentsPulled/commentsPushed at zero even when an outbound comment is queued, while treating every possible two-way comment read as work and therefore returning nothingToDo=false on a quiet linked repository. Make previews expose actual planned comment dispositions without provider writes and preserve truthful no-op semantics.
