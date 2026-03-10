---
type: is
id: is-01kf758578sxfk68eg8yb8c0ys
title: "Remove dead code: hash.ts content hashing functions are unused"
kind: chore
status: closed
priority: 3
version: 7
labels: []
dependencies: []
created_at: 2026-01-17T23:39:35.527Z
updated_at: 2026-03-09T16:12:31.176Z
closed_at: 2026-01-26T17:16:50.675Z
close_reason: Dead code removed - hash.ts file no longer exists in the codebase
---
The file packages/tbd-cli/src/file/hash.ts defines computeContentHash() and canonicalizeForHash() but these are never called anywhere in the codebase. Either remove the dead code or document why it's being kept for future use.
