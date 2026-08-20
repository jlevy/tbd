---
type: is
id: is-01m0ermpnsr0p90kjea0vg969a
title: A skip-only full sync still reports 'nothing to do'
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
delegate: claude-code@spud10
labels: []
dependencies: []
parent_id: is-01m0ermjzgy620e6gx9mtp7z9d
hold: null
hold_until: null
created_at: 2026-08-20T05:00:01.592Z
updated_at: 2026-08-20T05:12:28.234Z
started_at: 2026-08-20T05:07:15.003Z
closed_at: 2026-08-20T05:12:28.233Z
close_reason: Fixed. Both nothingToDo computations count skippedPushes, so a skip-only run no longer reports nothing to do and the detail lines render. skipPush generalized off the assignee hardcode onto per-field applyBase. Test verified by reverting the fix.
resolution: null
duplicate_of: null
---
Same family as OS-351. reconcile.ts skipPush is hardcoded to assignee, and sync-engine nothingToDo omits skippedPushes (around :966 and :1560), so a run whose only outcome is a skipped field push prints 'nothing to do' and the detail lines never render. The mirror/--push path was fixed in 1a39d717; the reconcile path was not.
