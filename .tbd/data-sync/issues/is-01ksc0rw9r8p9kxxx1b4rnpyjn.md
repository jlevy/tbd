---
type: is
id: is-01ksc0rw9r8p9kxxx1b4rnpyjn
title: Refactor agent integration path model
kind: task
status: open
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels:
  - agent-skills
  - setup
dependencies:
  - type: blocks
    target: is-01ksby3fdgasqh37gd81zees15
  - type: blocks
    target: is-01ksc0s4vq2w1yyp10fybqpq8t
  - type: blocks
    target: is-01ksc0t1njfwsxfv86vvgdb4y2
  - type: blocks
    target: is-01ksdq6jr5nrtjtc194fz17kry
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T03:34:30.967Z
updated_at: 2026-05-24T19:27:29.876Z
---
Update integration path constants and helper APIs so tbd has first-class project-local paths for .agents/skills/tbd/SKILL.md, .claude/skills/tbd/SKILL.md, AGENTS.md, any shared agent scripts, and the repository distribution copy skills/tbd/SKILL.md. Keep project-local install policy explicit and avoid global writes except detection.
