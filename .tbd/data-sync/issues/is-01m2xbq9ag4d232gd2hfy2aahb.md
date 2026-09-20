---
type: is
id: is-01m2xbq9ag4d232gd2hfy2aahb
title: Encode reviewable-unit and stack-shape rules in PR shortcuts
kind: task
status: closed
priority: 2
version: 4
delegate: claude-code@spud10.local
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-19T17:34:14.863Z
updated_at: 2026-09-20T05:50:31.833Z
started_at: 2026-09-19T17:34:31.820Z
closed_at: 2026-09-20T05:50:31.826Z
close_reason: "Policy is on open tbd PR #316 https://github.com/jlevy/tbd/pull/316 (docs/reviewable-pr-units @ e14eb1bb). CI green. Isolated docs PR; do not merge unless asked. Metabrowser overlay is #219, not AGENTS.md."
resolution: null
duplicate_of: null
---
Isolated docs change: one written PR-size/stack-shape rule in tbd shortcuts (standalone vs spec work, typically 8 PRs per stack, two-level review). Source of the policy requested from metabrowser mb-109m; land only in tbd.

## Notes

Local commit a0dca540 on docs/reviewable-pr-units. Focused tests and pre-commit passed. Pre-push full suite flakes on unrelated 5s timeouts; PR not opened yet.
