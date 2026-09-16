---
type: is
id: is-01kzn2wakpq2963exxqhj8xkdc
title: "Phase 3: GitHub adapter for issues and PR links"
kind: task
status: open
priority: 2
version: 9
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies: []
parent_id: is-01kzn2w85qxpbp8cqtn7mkbvkg
child_order_hints:
  - is-01kzn514mxmazhwq9fn1qpcpvt
  - is-01kzn5152hkvnx553tj4gwgc28
  - is-01kzn515e154th2ehqthkpcv0v
  - is-01kzx8kn4vtndb0t84345snpy5
  - is-01kzx8knkqyxmghreewwsy16h9
created_at: 2026-08-10T05:38:41.909Z
updated_at: 2026-09-16T00:17:50.557Z
extensions:
  linear:
    id: ba27c535-ee1e-4f31-b613-cd1caec5fa18
    key: TBD-1
    url: https://linear.app/finterm-ai/issue/TBD-1/phase-3-github-adapter-for-issues-and-pr-links
    linked_at: 2026-08-10T19:37:38.377Z
---

## Notes

Refreshed GitHub provider research landed on main-track PR #295: docs/project/research/current/research-2026-09-15-github-issues-for-tracker-adapter.md. It salvages the reusable half of closed PR #83 (head 4795e47f, Feb 2026) and re-verifies every API fact against docs.github.com and live GraphQL introspection on 2026-09-15. Read it before starting any child bead: it maps GitHub onto the TrackerAdapter seam member by member, maps the slot vocabulary (terminal axis exact, five open-end slots have no GitHub column), maps assignee vs delegate, names the three places GitHub does not fit the Linear-shaped seam (no client id on create, no attachment object for the tbd://bead claim, no comment resolve lifecycle), lists what changed since Feb 2026 (REST API version 2026-03-10, state_reason duplicate + duplicate_issue_id, org issue fields, issue dependencies, sub-issue REST, agent assignment, Projects REST), and carries an open-question list keyed to lmo9/tnks/v75l/v1u1. PR #83 itself is closed as superseded; its branch claude/external-issue-linking-1rGfb is kept for reference.
