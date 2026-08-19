---
type: is
id: is-01kzn510a0s6yafgt5j1x9nyss
title: tbd integration mirror subcommand with dry-run and json
kind: task
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn5117ezkyh9c1dqgr9pwty
parent_id: is-01kzn2w9w9gx9j6h3b250jnyzf
created_at: 2026-08-10T06:16:12.351Z
updated_at: 2026-08-10T17:35:53.948Z
closed_at: 2026-08-10T17:35:53.948Z
close_reason: Implemented in claude/linear-integration (c23d14d7, 3f1354e9, eb2c5bcf). Verified by 1561 vitest tests and a live check against the Linear API.
---
Wire planMirror/applyMirror into the command group. --dry-run prints the plan without writes. --json emits MirrorReport. Re-running with no changes must be a verified no-op. Cost envelope: ~21 epics x ~4 calls is well under 2500 req/hr. Spec Component 9.
