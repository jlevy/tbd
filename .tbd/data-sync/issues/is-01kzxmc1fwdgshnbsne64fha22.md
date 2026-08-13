---
type: is
id: is-01kzxmc1fwdgshnbsne64fha22
title: Guard every stale outbound intent after unlink
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
created_at: 2026-08-13T13:18:18.102Z
updated_at: 2026-08-13T13:38:45.045Z
closed_at: 2026-08-13T13:38:45.044Z
close_reason: Fixed with complete live-link replay validation and crash-safe provisional create identity.
---
PR #206 thread PRRT_kwDOQ109P86Y8DVz reports that cross-machine or surviving journals other than post_comment (update/create/attachment/splice/post_conflict) can still reach the provider after unlink because replay's current-state guard is comment-specific. Validate every intent identity/liveness contract and implement a provider-write-free stale replay disposition with TDD, or rebut with complete proof.

## Notes

Validated Bugbot thread PRRT_kwDOQ109P86Y8DVz. Fixed provider-neutrally: every intent operation now owns a bead_id; replay requires that bead to retain the exact provider id (and comments additionally retain the exact unpushed local entry); creates persist their client UUID as a provisional link before provider I/O. TDD proves all six write kinds are consumed with zero provider I/O after unlink and provisional-create crash replay converges. Focused 59 tests and full 1,927-test suite pass.
