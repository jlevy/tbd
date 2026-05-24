---
type: is
id: is-01ksc0rw9r8p9kxxx1b4rnpyjn
title: Refactor agent integration path model
kind: task
status: open
priority: 1
version: 4
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
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T03:34:30.967Z
updated_at: 2026-05-24T03:36:26.174Z
---
Update integration path constants and helper APIs so tbd has first-class project-local paths for .agents/skills/tbd/SKILL.md, .claude/skills/tbd/SKILL.md, AGENTS.md, any shared agent scripts, and the repository distribution copy skills/tbd/SKILL.md. Keep project-local install policy explicit and avoid global writes except detection.
