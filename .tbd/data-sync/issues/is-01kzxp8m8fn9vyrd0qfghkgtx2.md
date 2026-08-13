---
type: is
id: is-01kzxp8m8fn9vyrd0qfghkgtx2
title: Keep provisional creates out of orphan classification
kind: bug
status: closed
priority: 0
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - integration
  - review
dependencies: []
parent_id: is-01kzx848mdfzapsc2ddm6hm0zt
created_at: 2026-08-13T13:51:23.406Z
updated_at: 2026-08-13T14:06:23.784Z
closed_at: 2026-08-13T14:06:23.783Z
close_reason: Fixed with TDD; authoritative spec, design, user docs, and changelog updated; all local release-candidate gates pass.
---
PR #206 thread PRRT_kwDOQ109P86Y9B9_ reports that a failed outbound create leaves a provisional link whose not-yet-created provider UUID is classified as orphaned on a later full or pull-only run. Validate the state model and ensure pending creates remain pending without misleading orphan output or operator-dangerous remediation, with TDD.

## Notes

Validated Bugbot's claim with a red regression test. Fixed by deriving exact bead_id/client_id pending-create claims from durable intent journals under the shared data-sync lock; liveness fetch and orphan classification now skip only those provisional pairs in full and pull-only modes. Regression proves failed replay remains pending, reports no orphan, retains the journal, and performs no provider write during pull-only. Full gates: 1,929 Vitest and 1,084 Tryscript scenarios green.
