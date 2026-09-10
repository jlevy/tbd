---
type: is
id: is-01m267haz1m01b0ccpe6vyaxzp
title: Refresh authoritative issue schema and merge rules
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: codex@spud10.local
labels: []
dependencies: []
parent_id: is-01m262ajn3ttv71mxamxce3ykf
hold: null
hold_until: null
created_at: 2026-09-10T17:58:33.695Z
updated_at: 2026-09-10T20:20:02.584Z
started_at: 2026-09-10T18:27:47.431Z
closed_at: 2026-09-10T20:20:02.584Z
close_reason: Reconciled implementation and documentation, validated links and formatting, passed lint/build/publint/golden tests, and passed focused tests; the single full-suite load timeout passed in isolation.
resolution: null
duplicate_of: null
---
DOC-AUDIT-04: The main design predates shipped f08 issue fields, nullable semantics, passthrough preservation, lifecycle invariants, and exhaustive merge strategies. Reconcile sections 2.7 and 3.5 with schemas.ts and file/git.ts.
