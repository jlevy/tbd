---
close_reason: null
closed_at: 2026-01-16T21:55:33.687Z
created_at: 2026-01-15T22:30:01.000Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.147Z
    original_id: tbd-1801
id: is-01kf5zyg8mpeef5dtbv7wy5egj
kind: bug
labels:
  - ci
  - phase-17
  - pnpm
parent_id: null
priority: 0
status: closed
title: Fix pnpm version conflict in CI workflow
type: is
updated_at: 2026-03-09T16:12:30.001Z
version: 6
---
Remove explicit pnpm version from GitHub Actions to let it read from packageManager field in package.json.
