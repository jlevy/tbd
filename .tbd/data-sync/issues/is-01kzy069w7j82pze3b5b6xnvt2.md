---
type: is
id: is-01kzy069w7j82pze3b5b6xnvt2
title: Implement or remove inert Linear user_map assignee contract
kind: bug
status: closed
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - linear
  - integration
  - assignee
dependencies: []
parent_id: is-01kzxz1e815hsxmyhykdabhcxr
created_at: 2026-08-13T16:44:52.998Z
updated_at: 2026-08-13T18:09:18.405Z
closed_at: 2026-08-13T18:09:18.404Z
close_reason: The complete user_map contract now covers initial import and linked reconciliation in both directions, with runtime UUID/email resolution, safe alias persistence, invalid/duplicate target rejection, unmapped skips, deterministic tests, and live API round-trip proof.
---
The public config and docs promise user_map-backed assignee synchronization, but ProviderConfig drops user_map, CanonicalPatch cannot carry an assignee, and reconcile always marks outbound assignee writes unsupported. Either implement the documented UUID/email-to-display mapping safely in both directions or remove/reject the inert config; never silently accept a setting that has no effect.

## Notes

Implemented and verified the final initial-import path: mapped aliases now seed a newly imported bead and its bridge base, unmapped identities remain omitted, and emails never persist. Deterministic import/engine tests and the live provider-to-tbd reassignment scenario passed.
