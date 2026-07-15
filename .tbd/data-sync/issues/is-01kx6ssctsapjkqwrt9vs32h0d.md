---
type: is
id: is-01kx6ssctsapjkqwrt9vs32h0d
title: Consolidate close/reopen/update bulk orchestration into a shared runBulkMutation driver
kind: task
status: open
priority: 3
version: 1
spec_path: docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
labels: []
dependencies: []
created_at: 2026-07-10T19:59:03.000Z
updated_at: 2026-07-10T19:59:03.000Z
---
Non-blocking maintainability suggestion from the 2026-07-10 senior review of PR #176 (round 3): close, reopen, and update each duplicate the resolve -> preflight -> dry-run -> apply -> order/error/output orchestration around lib/bulk.ts helpers. A shared runBulkMutation driver taking a command-specific mutation callback would make the safety and output rules harder to diverge. Do after Phase 1 merges; keep goldens byte-identical.
