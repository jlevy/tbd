---
type: is
id: is-01m2erphvafq7s0t4fa4q7enpa
title: "Merge #279 (provider comments preserved through recovery, scoped to link lineage)"
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies:
  - type: blocks
    target: is-01m2erpjam82cmvb04dvjknhe8
parent_id: is-01m2erp0t0njvw8medbk3x70vz
created_at: 2026-09-14T01:32:25.833Z
updated_at: 2026-09-14T01:46:00.821Z
---
Layer 2 of tbd-m88s. Branch codex/stability-comment-recovery, head 0b09e169 (tree identical to c9c65169). Reachable behavior change: preserveExtensionComments runs after every mergeIssues (ordinary sync merge, rescue, workspace import). The senior review found PR279-R1 (High: comments moved across link identities); the fix in c9c65169 has an author disposition but no independent re-review.

Merge gate added 2026-09-14 from the release-compatibility review: tbd-s3zx (scope the comment union to provider namespaces), tbd-apnu (sync and merge-refs lineage tests), tbd-cskr (independent re-review of the PR279-R1 fix). The sync attic gap tbd-ajq2 is pre-existing and gates the release (tbd-lz1q), not this merge, but its decision fixes the docs wording on #283.
