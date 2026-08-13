---
type: is
id: is-01kzy621rv7w39vyzctfznr88y
title: "PR #206 R14: quarantine unmapped Linear assignees"
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - linear
  - review
dependencies: []
parent_id: is-01kzx8jw39zc4dpgx6w82rg3dm
created_at: 2026-08-13T18:27:25.082Z
updated_at: 2026-08-13T18:36:23.212Z
closed_at: 2026-08-13T18:36:23.211Z
close_reason: "Fixed: unmapped Linear identities are quarantined and cannot enter bead or bridge state; regression and live/full QA are green."
---
Bugbot thread PRRT_kwDOQ109P86ZCkD4 at packages/tbd/src/integrations/linear/adapter.ts:566-583 and core/sync-engine.ts:611-619. Unmapped Linear display names currently enter ExternalIssue, reconciliation, beads, and bridge bases despite the user_map-only contract. Represent mapping availability explicitly, persist no raw identity, leave the assignee field unchanged when the remote identity is unmapped, emit a safe warning, and prove linked/import behavior.

## Notes

Fixed with explicit assigneeSyncable semantics: adapter emits only mapped aliases or null, reports a PII-safe warning for unmapped provider identities, and reconciliation skips the assignee field so local and bridge-base values remain canonical. TDD covers adapter and sync-engine behavior. Live Linear QA passed 11/11; full gate passed 134 files / 1,966 tests.
