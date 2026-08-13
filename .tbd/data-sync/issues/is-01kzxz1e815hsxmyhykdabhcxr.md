---
type: is
id: is-01kzxz1e815hsxmyhykdabhcxr
title: Audit Linear and tbd workflow semantic corner cases
kind: task
status: open
priority: 1
version: 1
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - linear
  - integration
  - design
dependencies: []
parent_id: is-01kzxxj27abvbje3nesecgsk3z
created_at: 2026-08-13T16:24:45.056Z
updated_at: 2026-08-13T16:24:45.056Z
---
Build and validate a complete compatibility matrix for Linear versus tbd workflow semantics: status groups and custom states, blocked/deferred carriers, priority mapping, assignees and user_map, labels, archives/deletes, parent creation/reparenting/cycles/depth, comments/pagination/authors/timestamps, concurrent edits/conflicts, partial failures/retries, inbound discovery/claims, policy and mode changes, rate limits, and deterministic convergence. Assign every case a fixed, explicitly unsupported, or safely deferred disposition and reflect it in tests and docs.
