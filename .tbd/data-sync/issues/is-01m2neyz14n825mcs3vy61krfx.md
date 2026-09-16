---
type: is
id: is-01m2neyz14n825mcs3vy61krfx
title: Route explicit stacked-PR intent to the formal stack workflow
kind: bug
status: closed
priority: 1
version: 5
delegate: codex@spud10
labels:
  - stacked-prs
  - docs
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T15:56:56.733Z
updated_at: 2026-09-16T16:53:58.035Z
started_at: 2026-09-16T15:57:10.659Z
closed_at: 2026-09-16T16:53:58.035Z
close_reason: Implemented with focused setup, routing, transcript, installer, and packed-upgrade coverage.
resolution: null
duplicate_of: null
---
The generated skill tiers route generic PR creation but do not route explicit phrases such as stacked PR, stack this, or dependent PRs to the stacked-prs shortcut. Add explicit routing in every tier and prevent the PR workflow from silently falling back to a flat PR when stack intent is explicit. Add focused generated-surface coverage.

## Notes

Every generated skill tier routes explicit stacked/dependent PR intent to stacked-prs. PR workflows distinguish local tracking, authoritative remote membership, and flat PRs; they cover existing locally tracked PRs before remote linking, resolve local/origin diff bases, and refuse flat fallbacks. Focused integration coverage passes.
