---
type: is
id: is-01m00sk6jwdpjzznz61cqx6bgc
title: Implement GitHub CLI session readiness for coding agents
kind: feature
status: open
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-14-github-cli-session-readiness.md
labels: []
dependencies: []
created_at: 2026-08-14T18:47:18.874Z
updated_at: 2026-08-14T20:24:38.353Z
---
Make GitHub CLI reliably usable in supported remote sessions by verifying the direct GitHub channel, persisting a scoped proxy bypass through documented session environment support, emitting one environment-appropriate verdict, and keeping proxy internals on demand.

## Notes

Plan accepted and merged in tbd PR #224 at 80c3638f on 2026-08-14. PRs #219 and #221 were closed as superseded. Implementation remains open: add recognized mediated-session detection, verify the direct GitHub channel, persist the scoped bypass through CLAUDE_ENV_FILE, keep healthy local sessions silent, and move proxy internals to the on-demand reference.
