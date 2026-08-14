---
type: is
id: is-01m00j9jkhwgbczp3hkcy38z7q
title: A quiet tbd sync must write nothing (bridge records rewritten on every run)
kind: bug
status: open
priority: 0
version: 9
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - sync-efficiency
  - phase-1
dependencies:
  - type: blocks
    target: is-01m00h60xmsj85fqn07wkrtjqd
  - type: blocks
    target: is-01m00h57nkvtvkbqn992w5fm2e
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:39:43.473Z
updated_at: 2026-08-14T21:27:09.703Z
---

## Notes

RESOLVED in PR #227, but NOT as specified. The spec preferred dropping synced_at; that is wrong — pickNewestLinkRecord (git.ts:2117-2125) uses it as a merge tiebreaker when two machines observe the same item, so it is load-bearing. Only its role as a WRITE TRIGGER was the defect. Shipped fix: writeLinkRecordIfChanged compares everything except synced_at and skips the write when nothing else differs. Regression test asserts a settled mirror leaves bridge/<provider>/links/ byte-identical, and was verified to fail without the fix.
