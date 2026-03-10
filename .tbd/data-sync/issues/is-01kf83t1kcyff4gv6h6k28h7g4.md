---
type: is
id: is-01kf83t1kcyff4gv6h6k28h7g4
title: Track modified issues at commit time and pass to commit message generator
kind: task
status: open
priority: 2
version: 9
labels: []
dependencies:
  - type: blocks
    target: is-01kf83qst1yakat6384xpw3bx1
  - type: blocks
    target: is-01kf83qt6gtdzx5gx98cc0y6jj
parent_id: is-01kf83qm50827p60a7cg7jkqpd
created_at: 2026-01-18T08:33:38.923Z
updated_at: 2026-03-09T16:12:31.949Z
---
During sync operations, we already know which issues are being modified. The approach:

1. In commitWorktreeChanges() or its caller, track which issues were created/updated/deleted
2. Pass this list of Issue objects to the commit message generator
3. The caller (sync command) already has access to issues via listIssues() and knows what changed

Key files:
- sync.ts: commitWorktreeChanges() method (line ~272)
- The sync operation knows the issues - just need to pass them through

No git parsing needed - we track the issues as we're writing them.
