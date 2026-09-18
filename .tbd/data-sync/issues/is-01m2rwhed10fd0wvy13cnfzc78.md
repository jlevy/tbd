---
type: is
id: is-01m2rwhed10fd0wvy13cnfzc78
title: "PR #309 A10: changelog must say 0.9.0 rewrites config.yml before stopping"
kind: bug
status: open
priority: 3
version: 1
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
created_at: 2026-09-17T23:51:57.088Z
updated_at: 2026-09-17T23:51:57.088Z
---
Severity: Low. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242256965. File: packages/tbd/CHANGELOG.md:16-26. Upgrade note omits that 0.9.0 updates .tbd/config.yml before it stops. Fix: add discard-and-re-run sentence.
