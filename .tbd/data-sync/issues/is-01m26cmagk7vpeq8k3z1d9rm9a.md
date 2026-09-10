---
type: is
id: is-01m26cmagk7vpeq8k3z1d9rm9a
title: Abort corrupted-worktree repair when backup fails
kind: bug
status: open
priority: 0
version: 1
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
created_at: 2026-09-10T19:27:34.413Z
updated_at: 2026-09-10T19:27:34.413Z
---
repairCorruptedWorktree catches backup copy failures, recursively removes the worktree anyway, and reports a backup path that may not exist. Fail closed before removal unless durable backup succeeds, with a forced-copy-failure regression. Treat as a release safety blocker.
