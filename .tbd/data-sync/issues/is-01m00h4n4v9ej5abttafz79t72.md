---
type: is
id: is-01m00h4n4v9ej5abttafz79t72
title: Add tbd doctor check that executes the installed hook scripts
kind: task
status: open
priority: 2
version: 5
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-1
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:19:33.659Z
updated_at: 2026-08-16T00:10:47.110Z
extensions:
  linear:
    id: d6f6e5db-123b-46a1-8041-d0efaff78e48
    linked_at: 2026-08-16T00:10:47.110Z
---
doctor verifies hook files exist and are wired into settings, but never runs them, so it cannot detect the failure in §1.3. Execute each installed hook script with a probe input and report its exit code and first stderr line.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md E7
