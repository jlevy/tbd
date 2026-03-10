---
type: is
id: is-01kf7mmc2kzbrfcxcmjc052e07
title: Migrate commands to issue formatting utilities
kind: task
status: closed
priority: 2
version: 11
labels: []
dependencies:
  - type: blocks
    target: is-01kf7mmy2wq0qgmaxj55vtsvsc
created_at: 2026-01-18T04:08:24.402Z
updated_at: 2026-03-09T16:12:31.596Z
closed_at: 2026-01-18T05:30:26.539Z
close_reason: Migrated list, ready, blocked, search commands to use formatIssueLine, formatIssueHeader, formatIssueCompact utilities
---
Update commands to use issueFormat.ts utilities:
- Update list.ts to use formatIssueLine() and formatIssueHeader()
- Update show.ts to use issue formatting utilities for dependencies
- Update ready.ts to use formatIssueLine()
- Update blocked.ts to use formatIssueLine() and formatIssueCompact()
- Update search.ts to use formatIssueLine()
- Update success/notice messages to use formatIssueInline() consistently

Reference: plan spec Phase 2 implementation tasks
