---
type: is
id: is-01kzn50wa5k1s8m5xy4mr5tvtb
title: "file/git.ts: linked merge_by_id with single-source collapse, last_actor lww"
kind: task
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn50zedj6hwqx4j3e07mwqy
  - type: blocks
    target: is-01kzn510qqbk3ax3pbw447xw8y
parent_id: is-01kzn2w9gdhb0xt2hztn7v0aha
created_at: 2026-08-10T06:16:08.260Z
updated_at: 2026-08-10T19:55:07.298Z
closed_at: 2026-08-10T19:55:07.297Z
close_reason: Implemented as the linked_single_source merge strategy in file/git.ts with collapseLinked, plus last_actor lww. Covered by merge-namespaces.test.ts including deterministic tie-breaking.
---
FIELD_STRATEGIES gains linked: 'merge_by_id' keyed on (provider, id) and last_actor: 'lww'. A bead links to AT MOST ONE external source so every sync is one pair against one base, never multi-master needing per-field provenance. Collapse rule in mergeIssues: if a merge yields more than one entry, keep the newest linked_at and preserve the loser in the attic. Spec Component 3.
