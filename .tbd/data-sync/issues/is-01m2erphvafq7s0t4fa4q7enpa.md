---
type: is
id: is-01m2erphvafq7s0t4fa4q7enpa
title: "Merge #279 (provider comments preserved through recovery, scoped to link lineage)"
kind: task
status: closed
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies:
  - type: blocks
    target: is-01m2erpjam82cmvb04dvjknhe8
parent_id: is-01m2erp0t0njvw8medbk3x70vz
created_at: 2026-09-14T01:32:25.833Z
updated_at: 2026-09-14T02:42:26.499Z
closed_at: 2026-09-14T02:42:26.489Z
close_reason: "Merged to main in 9753fad5 (2026-09-14) before its gates closed: tbd-s3zx (comment union rewrites third-party extensions data), tbd-apnu (sync and merge-refs lineage tests), and tbd-cskr (independent re-review of the PR279-R1 fix) are still open and now apply to main; they gate the next release via tbd-lz1q."
resolution: null
duplicate_of: null
---
Layer 2 of tbd-m88s. Branch codex/stability-comment-recovery, head 0b09e169 (tree identical to c9c65169). Reachable behavior change: preserveExtensionComments runs after every mergeIssues (ordinary sync merge, rescue, workspace import). The senior review found PR279-R1 (High: comments moved across link identities); the fix in c9c65169 has an author disposition but no independent re-review.

Merge gate added 2026-09-14 from the release-compatibility review: tbd-s3zx (scope the comment union to provider namespaces), tbd-apnu (sync and merge-refs lineage tests), tbd-cskr (independent re-review of the PR279-R1 fix). The sync attic gap tbd-ajq2 is pre-existing and gates the release (tbd-lz1q), not this merge, but its decision fixes the docs wording on #283.

2026-09-14 status: head 0b09e169, mergeable CLEAN, all checks green. Not ready: waits on tbd-s3zx, tbd-apnu, tbd-cskr.
