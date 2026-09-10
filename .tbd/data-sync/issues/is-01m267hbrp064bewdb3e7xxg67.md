---
type: is
id: is-01m267hbrp064bewdb3e7xxg67
title: Scope raw watch delivery and mutation guarantees
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
created_at: 2026-09-10T17:58:34.517Z
updated_at: 2026-09-10T20:20:02.624Z
started_at: 2026-09-10T18:27:47.463Z
closed_at: 2026-09-10T20:20:02.624Z
close_reason: Reconciled implementation and documentation, validated links and formatting, passed lint/build/publint/golden tests, and passed focused tests; the single full-suite load timeout passed in isolation.
resolution: null
duplicate_of: null
---
DOC-AUDIT-06: Raw tbd watch has no persisted baseline unless the caller supplies --since, so at-least-once belongs to a cursor/pending protocol. It also writes repo-scoped private refs while preserving the caller and sync state. Correct the design and manual contracts.
