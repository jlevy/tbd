---
type: is
id: is-01kf5zyg8mpeef5dtbv7wy5egj
title: Fix pnpm version conflict in CI workflow
kind: bug
status: closed
priority: 0
version: 6
labels:
  - ci
  - phase-17
  - pnpm
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-15T22:30:01.000Z
updated_at: 2026-03-09T16:12:30.001Z
closed_at: 2026-01-16T21:55:33.687Z
close_reason: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.147Z
    original_id: tbd-1801
---
Remove explicit pnpm version from GitHub Actions to let it read from packageManager field in package.json.
