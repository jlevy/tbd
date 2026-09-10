---
type: is
id: is-01m26cgqrpe9qjtnw1ax710kqs
title: Finish provider link ownership corrections
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
created_at: 2026-09-10T19:25:36.911Z
updated_at: 2026-09-10T20:20:03.372Z
started_at: 2026-09-10T19:35:40.128Z
closed_at: 2026-09-10T20:20:03.372Z
close_reason: Reconciled implementation and documentation, validated links and formatting, passed lint/build/publint/golden tests, and passed focused tests; the single full-suite load timeout passed in isolation.
resolution: null
duplicate_of: null
---
Remove remaining claims that bead links retain mutable provider keys or URLs. Persist only id and linked_at in bead extensions; refresh external_key and external_url in bridge state.
