---
type: is
id: is-01ksc0thbsjf1629exkpyd5xn7
title: Self-apply tbd setup to this repository
kind: task
status: open
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels:
  - dogfood
  - setup
dependencies:
  - type: blocks
    target: is-01ksc0trd3x6wrkqx3dsb8cjfs
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T03:35:25.305Z
updated_at: 2026-05-25T23:39:39.641Z
---
Dogfood: build local CLI, run tbd setup --auto, commit refreshed .agents/skills/tbd/SKILL.md, the shrunk format-2 AGENTS.md block, .codex/ hooks, scripts/agent/ shared scripts, and skills/tbd/SKILL.md. Verify idempotent and that quality gates pass.
