---
type: is
id: is-01m2neyz14n825mcs3vy61krfx
title: Route explicit stacked-PR intent to the formal stack workflow
kind: bug
status: in_progress
priority: 1
version: 2
delegate: codex@spud10
labels:
  - stacked-prs
  - docs
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T15:56:56.733Z
updated_at: 2026-09-16T15:57:10.661Z
started_at: 2026-09-16T15:57:10.659Z
---
The generated skill tiers route generic PR creation but do not route explicit phrases such as stacked PR, stack this, or dependent PRs to the stacked-prs shortcut. Add explicit routing in every tier and prevent the PR workflow from silently falling back to a flat PR when stack intent is explicit. Add focused generated-surface coverage.
