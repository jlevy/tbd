---
type: is
id: is-01m2nh7vm82x8pqcsqwfn7jz7a
title: Verify pinned gh-stack skill identity during setup
kind: bug
status: in_progress
priority: 1
version: 2
delegate: codex@spud10
labels:
  - stacked-prs
  - security
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T16:36:45.311Z
updated_at: 2026-09-16T16:37:03.553Z
started_at: 2026-09-16T16:37:03.553Z
---
The ensure-gh-cli skill presence check accepts any skill named gh-stack, regardless of source, version, pin, or scope. Require the pinned github/gh-stack source and pinned commit identity for the owning agent, reject same-name collisions, and add shell coverage.
