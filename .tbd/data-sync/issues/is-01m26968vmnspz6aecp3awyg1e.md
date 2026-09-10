---
type: is
id: is-01m26968vmnspz6aecp3awyg1e
title: Correct integration fold-default source commentary
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
created_at: 2026-09-10T18:27:28.243Z
updated_at: 2026-09-10T20:20:03.317Z
started_at: 2026-09-10T18:27:47.538Z
closed_at: 2026-09-10T20:20:03.317Z
close_reason: Reconciled implementation and documentation, validated links and formatting, passed lint/build/publint/golden tests, and passed focused tests; the single full-suite load timeout passed in isolation.
resolution: null
duplicate_of: null
---
packages/tbd/src/lib/schemas.ts says the integration sync fold defaults to auto, but resolveSyncFoldMode and tests use guarded when unset. Align the schema comments with runtime.
