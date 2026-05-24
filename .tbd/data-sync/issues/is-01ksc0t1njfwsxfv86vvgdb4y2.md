---
type: is
id: is-01ksc0t1njfwsxfv86vvgdb4y2
title: Audit gitignore policy for agent integration files
kind: task
status: open
priority: 1
version: 2
labels:
  - gitignore
  - setup
dependencies:
  - type: blocks
    target: is-01ksc0thbsjf1629exkpyd5xn7
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T03:35:09.233Z
updated_at: 2026-05-24T03:36:32.418Z
---
Audit root .gitignore, .tbd/.gitignore, .claude/.gitignore, and generated setup behavior so files that should be checked in are not ignored: .agents/skills/tbd/SKILL.md, .claude/skills/tbd/SKILL.md, AGENTS.md, skills/tbd/SKILL.md, and required hook/bootstrap scripts. Keep only local caches, backups, state, and temporary files ignored.
