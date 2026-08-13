---
type: is
id: is-01kzxyaajyhadgprx4ws1gz7mk
title: Report planned comment work accurately in integration dry-runs
kind: bug
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - linear
  - integration
  - comments
dependencies: []
parent_id: is-01kzxy6ks7pd36nnzrppfdspq6
created_at: 2026-08-13T16:12:07.645Z
updated_at: 2026-08-13T17:55:55.852Z
closed_at: 2026-08-13T17:55:55.851Z
close_reason: "Comment synchronization is complete and verified: accurate dry-run reporting, complete pagination, preservation of pending local prose, and all four flow modes have focused tests, built-CLI coverage, documented boundaries, and live bidirectional/exact-once evidence."
extensions:
  linear:
    id: 530ad79d-73ce-485b-9700-b2f14295ce87
    linked_at: 2026-08-13T16:12:40.355Z
    key: TBD-165
    url: https://linear.app/finterm-ai/issue/TBD-165/report-planned-comment-work-accurately-in-integration-dry-runs
---
Dry-run leaves commentsPulled/commentsPushed at zero even when an outbound comment is queued, while treating every possible two-way comment read as work and therefore returning nothingToDo=false on a quiet linked repository. Make previews expose actual planned comment dispositions without provider writes and preserve truthful no-op semantics.
