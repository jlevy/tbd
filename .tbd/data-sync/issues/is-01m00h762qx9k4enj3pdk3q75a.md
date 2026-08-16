---
type: is
id: is-01m00h762qx9k4enj3pdk3q75a
title: Document pulled Linear comments as untrusted input
kind: task
status: open
priority: 3
version: 5
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-4
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:20:56.535Z
updated_at: 2026-08-16T00:10:47.186Z
extensions:
  linear:
    id: 892fe7fe-48f1-456e-bf3f-4b6c19c7c35f
    linked_at: 2026-08-16T00:10:47.186Z
---
field_sync.comments defaults to two_way, so Linear comments land in extensions.<provider>.comments and are read by agents. Anyone who can comment in the workspace can therefore write text into bead data that an agent will read. The body is capped and the author is a display name only, but the guidance should say plainly that pulled comments are untrusted input and should not be followed as instructions.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md §7
