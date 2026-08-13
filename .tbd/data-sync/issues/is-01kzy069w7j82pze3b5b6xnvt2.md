---
type: is
id: is-01kzy069w7j82pze3b5b6xnvt2
title: Implement or remove inert Linear user_map assignee contract
kind: bug
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - linear
  - integration
  - assignee
dependencies: []
parent_id: is-01kzxz1e815hsxmyhykdabhcxr
created_at: 2026-08-13T16:44:52.998Z
updated_at: 2026-08-13T17:55:56.917Z
closed_at: 2026-08-13T17:55:56.916Z
close_reason: "The user_map contract is implemented end to end: explicit alias-to-email/UUID mapping, runtime resolution, duplicate/invalid target validation, safe unmapped skips, reverse alias mapping on pull, no email persistence, and live bidirectional assignee evidence."
---
The public config and docs promise user_map-backed assignee synchronization, but ProviderConfig drops user_map, CanonicalPatch cannot carry an assignee, and reconcile always marks outbound assignee writes unsupported. Either implement the documented UUID/email-to-display mapping safely in both directions or remove/reject the inert config; never silently accept a setting that has no effect.
