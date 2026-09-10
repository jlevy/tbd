---
type: is
id: is-01m26793zb3d1vrhj56xav23zq
title: Repair current documentation cross-links
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
created_at: 2026-09-10T17:54:04.393Z
updated_at: 2026-09-10T20:20:03.220Z
started_at: 2026-09-10T18:27:47.396Z
closed_at: 2026-09-10T20:20:03.220Z
close_reason: Reconciled implementation and documentation, validated links and formatting, passed lint/build/publint/golden tests, and passed focused tests; the single full-suite load timeout passed in isolation.
resolution: null
duplicate_of: null
---
The full current-doc link audit found stale paths in the CLI design architecture and archived f08 rollout plan: the CLI plan had moved to specs/done, repo-root source links were resolved from the document directory incorrectly, and the publishing guide needed one additional parent segment. Correct the links and verify all changed Markdown links and explicit anchors.
