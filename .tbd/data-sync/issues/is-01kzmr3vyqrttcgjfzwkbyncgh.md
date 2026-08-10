---
type: is
id: is-01kzmr3vyqrttcgjfzwkbyncgh
title: Stabilize bulk mutation missing-ID transcript
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-07-19-bead-watch-and-external-sync.md
labels:
  - validation
  - testing
dependencies: []
parent_id: is-01kzmm8zqnf8q210etncddjn6h
created_at: 2026-08-10T02:30:34.710Z
updated_at: 2026-08-10T02:41:44.941Z
closed_at: 2026-08-10T02:41:44.941Z
close_reason: null
---
The full Tryscript validation can nondeterministically fail when generated ID test-zzz4 is close enough to sentinel test-zzzz to emit a fuzzy-match suggestion. Use a deliberately distant sentinel and preserve explicit fail-closed assertions.

## Notes

Replaced the potentially fuzzy-matched test-zzzz sentinel throughout the bulk-mutation transcript with non-generated test-zzzzzzz and pinned the three fail-closed error messages explicitly. Focused transcript passed 67/67; full Tryscript rerun passed 1,068/1,068.
