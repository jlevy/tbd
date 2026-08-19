---
type: is
id: is-01kx6ssctsapjkqwrt9vs32h0d
title: Consolidate close/reopen/update bulk orchestration into a shared runBulkMutation driver
kind: task
status: open
priority: 3
version: 4
spec_path: docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
labels:
  - pause
dependencies: []
created_at: 2026-07-10T19:59:03.000Z
updated_at: 2026-08-15T05:36:51.892Z
extensions:
  linear:
    id: 17e7162f-5364-47ed-ae68-78a1c7167ef5
    key: TBD-9
    url: https://linear.app/finterm-ai/issue/TBD-9/consolidate-closereopenupdate-bulk-orchestration-into-a-shared
    linked_at: 2026-08-10T19:37:25.341Z
---
Non-blocking maintainability suggestion from the 2026-07-10 senior review of PR #176 (round 3): close, reopen, and update each duplicate the resolve -> preflight -> dry-run -> apply -> order/error/output orchestration around lib/bulk.ts helpers. A shared runBulkMutation driver taking a command-specific mutation callback would make the safety and output rules harder to diverge. Do after Phase 1 merges; keep goldens byte-identical.
