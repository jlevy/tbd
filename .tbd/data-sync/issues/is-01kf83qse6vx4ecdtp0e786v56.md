---
type: is
id: is-01kf83qse6vx4ecdtp0e786v56
title: Parse git status to identify modified issue files and extract issue IDs
kind: task
status: closed
priority: 2
version: 11
labels: []
dependencies:
  - type: blocks
    target: is-01kf83qst1yakat6384xpw3bx1
  - type: blocks
    target: is-01kf83qt6gtdzx5gx98cc0y6jj
parent_id: is-01kf83qm50827p60a7cg7jkqpd
created_at: 2026-01-18T08:32:25.029Z
updated_at: 2026-03-09T16:12:31.927Z
closed_at: 2026-01-18T08:33:38.545Z
close_reason: Replaced with clearer task - we track issues at commit time, not parse git status
---
In commitWorktreeChanges(), after getting git status output, parse it to:
1. Filter for issue files (.tbd/data-sync/issues/*.md)
2. Extract the internal issue ID from each file path
3. Determine the action (new/modified/deleted) from status code
4. Return structured data with issue IDs and their actions

Use parseGitStatus from syncSummary.ts as reference.
