---
close_reason: Removed hardcoded docs/SKILL.md and docs/CURSOR.mdc - now generated from headers + skill.md during build
closed_at: 2026-01-23T02:53:45.766Z
created_at: 2026-01-23T01:48:43.622Z
dependencies:
  - target: is-01kfm8yvqk6t31j1g3pfjkmzc3
    type: blocks
  - target: is-01kf7j53z1gahrqswh8x4v4b6t
    type: blocks
id: is-01kfm8m6q751zf5rk4dganwfhy
kind: task
labels: []
priority: 2
status: closed
title: Remove hardcoded CURSOR.mdc, keep only source parts
type: is
updated_at: 2026-01-23T02:53:45.767Z
version: 6
---
After build composition is working:

1. Delete docs/SKILL.md (now generated from headers/claude.md + skill.md)
2. Delete docs/CURSOR.mdc (now generated from headers/cursor.md + skill.md)
3. Add generated files to .gitignore or keep them gitignored in packages/tbd/src/docs/
