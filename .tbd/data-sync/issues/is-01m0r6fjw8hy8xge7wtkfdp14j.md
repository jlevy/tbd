---
type: is
id: is-01m0r6fjw8hy8xge7wtkfdp14j
title: "PR #258 review R21: state Rust ownership contracts precisely"
kind: bug
status: closed
priority: 3
version: 3
labels:
  - review
dependencies: []
parent_id: is-01m0r5wdr6nrtymyeq46b5qnjr
created_at: 2026-08-23T20:55:03.815Z
updated_at: 2026-08-23T21:21:56.767Z
closed_at: 2026-08-23T21:21:56.767Z
close_reason: Fixed in a55041a0 with focused documentation corrections and regression coverage where executable.
---
packages/tbd/docs/guidelines/rust-rules.md. &str and &Path mean the callee does not take ownership, not that it only reads; a callee may derive/store owned data. Correct the wording without changing the surrounding ownership guidance.
