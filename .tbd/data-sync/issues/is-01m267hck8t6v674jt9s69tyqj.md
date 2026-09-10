---
type: is
id: is-01m267hck8t6v674jt9s69tyqj
title: Correct observation and issue-write design claims
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: codex@spud10.local
labels: []
dependencies: []
parent_id: is-01m262ajn3ttv71mxamxce3ykf
hold: null
hold_until: null
created_at: 2026-09-10T17:58:35.367Z
updated_at: 2026-09-10T20:20:03.255Z
started_at: 2026-09-10T18:27:47.496Z
closed_at: 2026-09-10T20:20:03.255Z
close_reason: Reconciled implementation and documentation, validated links and formatting, passed lint/build/publint/golden tests, and passed focused tests; the single full-suite load timeout passed in isolation.
resolution: null
duplicate_of: null
---
DOC-AUDIT-08: The main design says sync is the only issue writer and observation writes no process-visible state. Ordinary mutation commands write local issue state, and watch manages repo-scoped private refs. Document the actual isolation guarantee.
