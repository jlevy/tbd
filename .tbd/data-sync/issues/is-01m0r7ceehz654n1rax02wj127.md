---
type: is
id: is-01m0r7ceehz654n1rax02wj127
title: "PR #258 review R22: align filesystem enforcement with write intent"
kind: bug
status: closed
priority: 1
version: 3
labels:
  - review
dependencies: []
parent_id: is-01m0r5wdr6nrtymyeq46b5qnjr
created_at: 2026-08-23T21:10:49.552Z
updated_at: 2026-08-23T21:21:56.776Z
closed_at: 2026-08-23T21:21:56.776Z
close_reason: Fixed in a55041a0 with focused documentation corrections and regression coverage where executable.
---
packages/tbd/docs/guidelines/filesystem-rules.md and typescript-rules.md. The generic contract correctly distinguishes replace, append, exclusive-create, stream, and scratch writes, but still prescribes global raw-write bans and calls concurrent append record-safe. Scope enforcement to authoritative-persistence boundaries, state append interleaving precisely, and make the TypeScript instantiation match.
