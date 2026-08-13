---
type: is
id: is-01kzsv0s63msgwh561h8ec13ma
title: Reject incomplete or duplicate web snapshot candidates
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - concurrency
  - integrity
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T01:57:31.458Z
updated_at: 2026-08-12T04:38:51.095Z
closed_at: 2026-08-12T04:38:51.095Z
close_reason: Implemented and verified against the normative concurrency contract; focused adversarial coverage and the full release matrix pass.
---
The generic listIssues reader deliberately skips unreadable or invalid files, which is appropriate for diagnostics but unsafe for BoardState publication: a transient/corrupt file can appear as a deletion, and a mismatched filename can create duplicate logical content. Add strict web-snapshot validation for read/parse failures and filename/id mismatches; retain the last accepted snapshot and retry rather than publishing an incomplete candidate.
