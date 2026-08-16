---
type: is
id: is-01kzxg35z6xqe2s5j3wr6n315h
title: Prevent duplicate provider comments after crash replay
kind: bug
status: closed
priority: 0
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - integration
  - review
dependencies: []
parent_id: is-01kzx848mdfzapsc2ddm6hm0zt
created_at: 2026-08-13T12:03:33.475Z
updated_at: 2026-08-13T12:17:37.370Z
closed_at: 2026-08-13T12:17:37.369Z
close_reason: Fixed with crash-boundary regressions and full green release gate
---
PR #206 review thread PRRT_kwDOQ109P86Y6-25 reports that replaying a journaled post_comment may post with the durable client UUID but fail to mark the local comment pushed. Validate the crash sequence, add a failing regression first, and if confirmed make replay reconcile the bead-side comment identity before consuming the journal so the next sync cannot mint a second UUID.

## Notes

Confirmed. TDD reproduced the crash after Linear accepted the journaled comment but before the bead recorded its provider id. Fixed by persisting bead_id + local_id in post_comment intents; replay now returns the provider id, records and commits it while the journal remains durable, refreshes the current run working set, and only then permits cleanup/planning. A second regression proves recovery-callback failure keeps the intent and provider dedup remains exact-once. Gates: format/lint/typecheck/build; focused 88 and 37 tests; full 1,921 Vitest; 1,084 Tryscript; publint; package-age 31 pins/0 violations.
