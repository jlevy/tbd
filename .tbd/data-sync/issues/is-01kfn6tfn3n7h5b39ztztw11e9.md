---
type: is
id: is-01kfn6tfn3n7h5b39ztztw11e9
title: "skill.ts: incorrect dev fallback path"
kind: bug
status: closed
priority: 2
version: 7
labels:
  - high-priority
dependencies: []
created_at: 2026-01-23T10:36:26.658Z
updated_at: 2026-03-09T16:12:32.531Z
closed_at: 2026-01-23T10:37:53.746Z
close_reason: "Not a bug - path is correct: src/cli/commands needs 3 jumps to reach packages/tbd/docs/"
---
Uses 3 parent jumps but should use 2 to reach src/docs/.
