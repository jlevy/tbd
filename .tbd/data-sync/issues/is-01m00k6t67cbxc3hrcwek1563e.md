---
type: is
id: is-01m00k6t67cbxc3hrcwek1563e
title: Capture the PR ref automatically when a PR is created or updated
kind: task
status: open
priority: 2
version: 5
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - traceability
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:55:41.510Z
updated_at: 2026-08-16T00:10:47.229Z
extensions:
  linear:
    id: fd390f4f-40db-418f-9b8d-203d80a37c08
    linked_at: 2026-08-16T00:10:47.229Z
---
create-or-update-pr-simple holds the PR URL at its step 6 and currently only reports it to the user. Have it record the ref on the beads the branch closes.

tbd sync can additionally resolve the current branch's PR opportunistically via gh, recording it when found and staying silent when not — a bead must never be blocked on GitHub being reachable.

Depends on the refs field.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md §5.6, E17
