---
type: is
id: is-01m2ne3vf174y0mzs9gh96f5me
title: Self-upgrade repository setup to tbd v0.9.0
kind: task
status: in_progress
priority: 1
version: 2
delegate: claude-code@spud10.local
labels: []
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T15:42:08.221Z
updated_at: 2026-09-16T15:42:18.112Z
started_at: 2026-09-16T15:42:18.111Z
---
Dogfood the freshly published get-tbd@0.9.0 in this repository: verify npm provenance and release identity, install the exact public tarball under the documented supply-chain exception, run setup idempotently, review generated changes, run quality and package/install smoke checks, then commit, open and merge a green PR, sync tracking state, and leave the worktree clean.
