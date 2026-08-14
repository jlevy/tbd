---
type: is
id: is-01kzxmc219typjnb46kwsm83k3
title: Make unlink intent cancellation crash-atomic
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
created_at: 2026-08-13T13:18:18.664Z
updated_at: 2026-08-13T13:38:45.560Z
closed_at: 2026-08-13T13:38:45.559Z
close_reason: Fixed with retryable cancellation-first unlink ordering and failure-injection coverage.
---
PR #206 thread PRRT_kwDOQ109P86Y8DV7 reports that unlink clears the bead and bridge before discarding intents; a crash or discard failure in that window leaves no retryable unlink relationship and permits stale journals to survive. Validate the transaction ordering and establish a crash-safe, retryable unlink invariant with TDD, or rebut with complete proof.

## Notes

Validated Bugbot thread PRRT_kwDOQ109P86Y8DV7. Fixed unlink as a cancellation-first transaction under the shared data-sync lock: prune matching journal ops, clear the bead link, then delete the bridge record last. The record is the retry key after bead clear. Failure-injection TDD proves a malformed journal cannot clear the link; retry then removes the journal, link, and record safely. Focused 59 tests and full 1,927-test suite pass.
