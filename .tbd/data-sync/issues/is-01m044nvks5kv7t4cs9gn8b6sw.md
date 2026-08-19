---
type: is
id: is-01m044nvks5kv7t4cs9gn8b6sw
title: Sync's duplicate-link failure names a UUID where doctor names the issue key
kind: task
status: open
priority: 3
version: 3
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-16T01:58:43.574Z
updated_at: 2026-08-16T02:11:51.203Z
extensions:
  linear:
    id: 702670bb-f632-4c23-a430-52d23df997c5
    linked_at: 2026-08-16T02:11:51.203Z
---
duplicateExternalLinks now takes an optional keyByExternalId map so the report can name OS-77 instead of a bare UUID. Doctor passes it (src/cli/commands/doctor.ts); the sync engine does not, because its duplicate check runs at sync-engine.ts:391 while link records are not loaded until line 567.

Either move the record load earlier or pass the map through. Cosmetic only: the message already names the holding beads and the remedy command, which is what the operator acts on.
