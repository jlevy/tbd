---
type: is
id: is-01m26chk3mqp4kx0ad92wq5fbf
title: Remove obsolete setup --interactive command from packaged skill
kind: bug
status: closed
priority: 3
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: codex@spud10.local
labels: []
dependencies: []
parent_id: is-01m262ajn3ttv71mxamxce3ykf
hold: null
hold_until: null
created_at: 2026-09-10T19:26:04.907Z
updated_at: 2026-09-10T20:20:03.472Z
started_at: 2026-09-10T19:35:40.204Z
closed_at: 2026-09-10T20:20:03.472Z
close_reason: Reconciled implementation and documentation, validated links and formatting, passed lint/build/publint/golden tests, and passed focused tests; the single full-suite load timeout passed in isolation.
resolution: null
duplicate_of: null
---
The packaged Claude skill advertises tbd setup --interactive, but the current setup command exposes --auto and --from-beads only. Remove the obsolete command.
