---
type: is
id: is-01m00h4phk5sx8cf4meq0gpk9b
title: Teach the claim step in all four instruction surfaces
kind: task
status: closed
priority: 1
version: 9
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
docs:
  - path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
    role: design
labels:
  - phase-1
dependencies:
  - type: blocks
    target: is-01m00h60xmsj85fqn07wkrtjqd
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:19:35.091Z
updated_at: 2026-09-10T20:20:03.501Z
closed_at: 2026-09-10T20:20:03.501Z
close_reason: Reconciled implementation and documentation, validated links and formatting, passed lint/build/publint/golden tests, and passed focused tests; the single full-suite load timeout passed in isolation.
resolution: null
duplicate_of: null
extensions:
  linear:
    id: 1e31c9b2-e2d6-422f-8208-a9db058763f5
    linked_at: 2026-08-16T00:13:30.852Z
---
Claiming a bead appears in exactly one table row of skill-baseline ('tbd update <id> --status in_progress' = Claim work) and nowhere in AGENTS.md, skill-brief, skill-minimal, the closing protocol, implement-beads, or plan-implementation-with-beads. The closing protocol appears in all four and is obeyed; claiming appears in one and is not (0 assignees repo-wide).

Add Claim to all four surfaces and as a numbered step in implement-beads, mirroring how the closing protocol is repeated.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md §1.4, E9
