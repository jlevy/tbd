---
type: is
id: is-01m2ppx2e30bf6k8tzynb84120
title: Answer the plan's open questions (question round)
kind: task
status: closed
priority: 1
version: 16
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies:
  - type: blocks
    target: is-01m2pr26wk9nmdax9rmpxmmx5y
  - type: blocks
    target: is-01m2pr288xb6r9s0cw4j4wwfnv
  - type: blocks
    target: is-01m2pr2906rqnap8ry6ym5ceby
  - type: blocks
    target: is-01m2pr29b7r2ekzcr1yvrkhqdn
  - type: blocks
    target: is-01m2pr2b3n3e6xjq7t4khw113p
  - type: blocks
    target: is-01m2pr2c6gds2vz3y9x0nxdwka
  - type: blocks
    target: is-01m2pr2chxhjtktht45z3r4155
  - type: blocks
    target: is-01m2pttfc7cp9qz4ynvaxm16vx
parent_id: is-01m2ppwdem47zfrrfhh1rgbvzp
created_at: 2026-09-17T03:34:57.731Z
updated_at: 2026-09-17T06:24:21.333Z
closed_at: 2026-09-17T06:24:21.331Z
close_reason: "User decided 2026-09-16: proposals adopted for Q1-4, Q9-15; Q5-8 answered explicitly (block inside tbd block with integration format split; AGENTS.md only source; user-level fallback; GitHub grants by scope). Decisions integrated into the plan design; only README questions with defaults remain"
resolution: null
duplicate_of: null
---
Blocks design-dependent implementation beads. Open Questions in the plan spec: (1) tier agent definitions by default; (2) dedicated security/performance/correctness review shortcuts; (3) several PRs at once; (4) review coverage of fix commits; (5) policy block placement vs older tbd releases; (6) grant storage; (7) user-level grants at all; (8) scope of the two GitHub grants; (9) custom review requirement syntax; (10) 'not now' answers; (11) Linear epics direction; (12) static or grant-dependent tbd block; (13) administrative work and the fast tier; (14) the sub-agent model pin in this repo; (15) names.

## Notes

Decisions 2026-09-16 (user): adopt the plan's proposed answers for open questions 1-4 and 9-15. Grants design answered explicitly: Q5 policy block lives INSIDE the tbd block; setup preserves it; the block's integration format marker is split from the repository format and bumped so older tbd (0.9.0) refuses to rewrite rather than deleting grants. Q6 AGENTS.md policy block is the only source of truth (hand-editable, validated by tbd doctor). Q7 user-level grants are a fallback only for policies the project has not answered. Q8 GitHub grants scoped by scope not tool: github-editing = branches and PRs (push, create, review, edit, comment, watch CI) through any tool; github-workflows = rest of end-to-end workflow (issues, labels, re-run/cancel CI); neither covers repo settings, secrets, or workflow files. Execution: Opus sub-agents implement mechanical beads; a separate Fable sub-agent reviews all changes at the end.
