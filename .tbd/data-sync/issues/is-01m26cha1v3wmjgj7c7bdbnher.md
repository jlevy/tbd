---
type: is
id: is-01m26cha1v3wmjgj7c7bdbnher
title: Document inert tbd sync --force compatibility flag
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
created_at: 2026-09-10T19:25:55.639Z
updated_at: 2026-09-10T20:20:03.426Z
started_at: 2026-09-10T19:35:40.175Z
closed_at: 2026-09-10T20:20:03.426Z
close_reason: Reconciled implementation and documentation, validated links and formatting, passed lint/build/publint/golden tests, and passed focused tests; the single full-suite load timeout passed in isolation.
resolution: null
duplicate_of: null
---
Current docs describe tbd sync --force as overwriting conflicts even though the option is parsed and passed without behavioral effect. Correct current docs and separately track making the flag meaningful or removing it.
