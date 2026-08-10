---
type: is
id: is-01kzn50sw125xdztxh9rqhm5mp
title: "cli/commands/doctor.ts: non-fatal Integrations check"
kind: task
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn511m3x7ekbbkz2h5dcfqj
parent_id: is-01kzn2w8hvc83qrgk9h70rf73y
created_at: 2026-08-10T06:16:05.760Z
updated_at: 2026-08-10T06:16:13.698Z
---
Add one safeCheck('Integrations', ...) reusing the same probe functions as integration status. SKIPPED (not failed) when no provider is enabled, so doctor stays green and offline-safe for repos that never use this. Short network timeout; degrade to 'unreachable (network?)' rather than error. Spec Component 2.
