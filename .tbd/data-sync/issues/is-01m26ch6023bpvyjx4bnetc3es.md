---
type: is
id: is-01m26ch6023bpvyjx4bnetc3es
title: Qualify ready-report replay in current user docs
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
created_at: 2026-09-10T19:25:51.488Z
updated_at: 2026-09-10T20:20:03.411Z
started_at: 2026-09-10T19:35:40.163Z
closed_at: 2026-09-10T20:20:03.411Z
close_reason: Reconciled implementation and documentation, validated links and formatting, passed lint/build/publint/golden tests, and passed focused tests; the single full-suite load timeout passed in isolation.
resolution: null
duplicate_of: null
---
Current CLI and watch shortcut docs promise identical reports for identical commits, but --ready evaluates deferred_until at invocation time. State the exception and track deterministic evaluation under tbd-obw9.
