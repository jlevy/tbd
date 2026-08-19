---
type: is
id: is-01kzxz1e815hsxmyhykdabhcxr
title: Audit Linear and tbd workflow semantic corner cases
kind: task
status: closed
priority: 1
version: 9
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - linear
  - integration
  - design
dependencies: []
parent_id: is-01kzxxj27abvbje3nesecgsk3z
child_order_hints:
  - is-01kzy069w7j82pze3b5b6xnvt2
  - is-01kzy06a8qy5jw2m29wsasx7vc
  - is-01kzy0wnx8tena3fnh0ns4wxrk
  - is-01kzy0x95xwa7w5z59w9jeh2rz
  - is-01kzy1zb1zjem9fcjjgvrr6vjx
created_at: 2026-08-13T16:24:45.056Z
updated_at: 2026-08-13T17:56:04.377Z
closed_at: 2026-08-13T17:56:04.377Z
close_reason: "Compatibility review is complete: implementation gaps are fixed, all findings are mapped in the authoritative matrix, product/design/development/skill docs agree, deterministic CI is green (132 files, 1,956 tests), and the API-driven Linear gate passed all 11 scenarios with verified cleanup."
---
Build and validate a complete compatibility matrix for Linear versus tbd workflow semantics: status groups and custom states, blocked/deferred carriers, priority mapping, assignees and user_map, labels, archives/deletes, parent creation/reparenting/cycles/depth, comments/pagination/authors/timestamps, concurrent edits/conflicts, partial failures/retries, inbound discovery/claims, policy and mode changes, rate limits, and deterministic convergence. Assign every case a fixed, explicitly unsupported, or safely deferred disposition and reflect it in tests and docs.

## Notes

Completed the authoritative compatibility/evidence matrix in the active external-tracker plan. Every field, identity, hierarchy, lifecycle, comment, direction, concurrency, pagination, credential, and bulk case has Supported/Bounded/Unsupported/Deferred disposition plus implementation and proof seams. Added provider-neutral unknown-state warnings, project-scoped inbound discovery, mapped assignees, hierarchy preservation, and pagination/cap fixes. Updated product docs, design docs, development docs, QA playbook, packaged skill source, and installed skill mirrors.
