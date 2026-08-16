---
type: is
id: is-01m00sk6jwdpjzznz61cqx6bgc
title: Implement GitHub CLI session readiness for coding agents
kind: feature
status: open
priority: 2
version: 5
spec_path: docs/project/specs/active/plan-2026-08-14-github-cli-session-readiness.md
labels: []
dependencies: []
created_at: 2026-08-14T18:47:18.874Z
updated_at: 2026-08-16T00:10:47.261Z
extensions:
  linear:
    id: ba9c0016-a9d4-435f-b547-b7c7a04103f1
    linked_at: 2026-08-16T00:10:47.261Z
---
Make GitHub CLI reliably usable in supported remote sessions by verifying the direct GitHub channel, persisting a scoped proxy bypass through documented session environment support, emitting one environment-appropriate verdict, and keeping proxy internals on demand.

## Notes

Plan accepted and merged in tbd PR #224 at 80c3638f on 2026-08-14; exact-merge main CI run 31837695389 passed every job. PRs #219 and #221 were closed as superseded. Implementation remains open: add recognized mediated-session detection, verify the direct GitHub channel, persist the scoped bypass through CLAUDE_ENV_FILE, keep healthy local sessions silent, and move proxy internals to the on-demand reference.
