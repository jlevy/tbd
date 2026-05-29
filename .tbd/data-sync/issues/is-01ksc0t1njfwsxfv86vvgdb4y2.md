---
type: is
id: is-01ksc0t1njfwsxfv86vvgdb4y2
title: Audit gitignore policy for agent integration files
kind: task
status: open
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels:
  - gitignore
  - setup
dependencies:
  - type: blocks
    target: is-01ksc0thbsjf1629exkpyd5xn7
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T03:35:09.233Z
updated_at: 2026-05-25T23:39:38.510Z
---
Ensure .agents/skills/tbd/SKILL.md, .claude/skills/tbd/SKILL.md, AGENTS.md, .codex/* project files, scripts/agent/*, and skills/tbd/SKILL.md are NOT gitignored. Check .claude/.gitignore (currently *.bak) and root .gitignore. Only ignore caches/.tbd/docs/backups.
