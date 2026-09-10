---
type: is
id: is-01m266pxp22cn5mr8gf2hev3d3
title: Correct hidden-worktree merge example in main design
kind: bug
status: closed
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: codex@spud10.local
labels: []
dependencies: []
parent_id: is-01m262ajn3ttv71mxamxce3ykf
hold: null
hold_until: null
created_at: 2026-09-10T17:44:08.129Z
updated_at: 2026-09-10T20:20:03.115Z
started_at: 2026-09-10T18:27:56.760Z
closed_at: 2026-09-10T20:20:03.115Z
close_reason: Reconciled implementation and documentation, validated links and formatting, passed lint/build/publint/golden tests, and passed focused tests; the single full-suite load timeout passed in isolation.
resolution: null
duplicate_of: null
---
DOC-AUDIT-05: The packaged design labels its sync step as merge-capable while showing merge --ff-only. Match the current mergeRemoteIntoSyncBranch implementation and keep the example explicitly illustrative.
