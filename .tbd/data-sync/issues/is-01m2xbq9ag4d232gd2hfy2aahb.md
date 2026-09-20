---
type: is
id: is-01m2xbq9ag4d232gd2hfy2aahb
title: Encode reviewable-unit and stack-shape rules in PR shortcuts
kind: task
status: in_progress
priority: 2
version: 3
delegate: claude-code@spud10.local
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-19T17:34:14.863Z
updated_at: 2026-09-19T18:14:54.619Z
started_at: 2026-09-19T17:34:31.820Z
---
Isolated docs change: one written PR-size/stack-shape rule in tbd shortcuts (standalone vs spec work, typically 8 PRs per stack, two-level review). Source of the policy requested from metabrowser mb-109m; land only in tbd.

## Notes

Local commit a0dca540 on docs/reviewable-pr-units. Focused tests and pre-commit passed. Pre-push full suite flakes on unrelated 5s timeouts; PR not opened yet.
