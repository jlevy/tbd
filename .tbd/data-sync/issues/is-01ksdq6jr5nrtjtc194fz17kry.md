---
type: is
id: is-01ksdq6jr5nrtjtc194fz17kry
title: Shrink generated AGENTS.md block
kind: task
status: open
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels:
  - agents-md
  - setup
  - agent-skills
dependencies:
  - type: blocks
    target: is-01ksc0skpmwe30svw66fjsztwg
  - type: blocks
    target: is-01ksc0sv2xc7j6wnb9xzsep7fg
  - type: blocks
    target: is-01ksc0ta2n1q3nkr2791574t56
  - type: blocks
    target: is-01ksc0thbsjf1629exkpyd5xn7
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T19:25:43.045Z
updated_at: 2026-05-24T19:27:47.614Z
---
Change tbd's generated AGENTS.md integration block from a full SKILL.md/resource-directory embed into a compact always-on bootstrap. Keep BEGIN/END markers, preserve user content outside markers, include only essential tbd operating rules and pointers to tbd prime, tbd skill, tbd shortcut --list, and tbd guidelines --list. Update tests/goldens accordingly.
