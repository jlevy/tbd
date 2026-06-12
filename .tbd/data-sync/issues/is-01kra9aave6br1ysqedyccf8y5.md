---
type: is
id: is-01kra9aave6br1ysqedyccf8y5
title: "Phase 1 tests: migration golden (f03→f05, f04→f05), source resolution, doc map"
kind: task
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-05-07-docs-config-redesign.md
labels: []
dependencies: []
parent_id: is-01kra98szn2ah4f59kmbnfbery
created_at: 2026-05-11T01:09:40.846Z
updated_at: 2026-06-12T15:46:23.592Z
---
- Migration golden tests for f03→f05 and f04→f05.
- Source resolution unit tests.
- Doc map golden tests.
- Existing tryscripts pass unchanged.
- Round-trip validation: migrated config produces identical resolved doc set as the source config did.

Spec: Phase 1 bullet 11 (line ~1631), ## Testing Strategy (line ~1704).

## Notes

Migration-golden half done by the f05 bump (f03→f05 in cli-shared-common-dir-worktree.tryscript.md; f04→f05 revert-and-repeat in common-dir-layout-doctor.test.ts). Source-resolution / sync-grouping halves still open (PR #117 scope).
