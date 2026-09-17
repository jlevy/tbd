---
type: is
id: is-01m2pr2906rqnap8ry6ym5ceby
title: "P2: Implement policy grants in code"
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies:
  - type: blocks
    target: is-01m2pr2a1gk8q58t6dwv4hxk45
  - type: blocks
    target: is-01m2pr2cx3yxc65xrmh4kpd9ef
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T03:55:16.869Z
updated_at: 2026-09-17T03:55:20.866Z
---
tbd policy show/grant/revoke/set; setup --policies flags; preserve the policy block on setup (including unknown names); guard against older releases per the placement decision; tbd prime prints effective and unanswered grants; tbd doctor validates the block and default-branch drift; update tbd-design.md and tbd-format-versioning.md.
