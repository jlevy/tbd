---
type: is
id: is-01kzn510a0s6yafgt5j1x9nyss
title: tbd integration mirror subcommand with dry-run and json
kind: task
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn5117ezkyh9c1dqgr9pwty
parent_id: is-01kzn2w9w9gx9j6h3b250jnyzf
created_at: 2026-08-10T06:16:12.351Z
updated_at: 2026-08-10T06:16:13.293Z
---
Wire planMirror/applyMirror into the command group. --dry-run prints the plan without writes. --json emits MirrorReport. Re-running with no changes must be a verified no-op. Cost envelope: ~21 epics x ~4 calls is well under 2500 req/hr. Spec Component 9.
