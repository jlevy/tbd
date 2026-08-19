---
type: is
id: is-01kzwvynxfzpa7fzxstea6e3p7
title: "PR #209 review S11: Extract reloadOnce snapshot guards"
kind: task
status: open
priority: 2
version: 4
labels:
  - review
  - refactor
  - followup
  - pause
dependencies: []
parent_id: null
created_at: 2026-08-13T06:11:34.446Z
updated_at: 2026-08-15T05:44:05.236Z
---
PR #209 senior review S11. packages/tbd/src/cli/web/board.ts reloadOnce repeats four epoch/marker guard blocks across roughly 220 lines. Extract capture/compare helpers or a small guarded-phase abstraction while preserving the proven concurrency semantics and tests.

## Notes

Disposition: deferred, non-blocking. reloadOnce guards are correct and fully exercised; extracting them during final review would add concurrency risk without changing behavior. Refactor separately under snapshot-consistency tests.
