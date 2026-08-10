---
type: is
id: is-01ksc0thbsjf1629exkpyd5xn7
title: Self-apply tbd setup to this repository
kind: task
status: open
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels:
  - dogfood
  - setup
dependencies:
  - type: blocks
    target: is-01ksc0trd3x6wrkqx3dsb8cjfs
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T03:35:25.305Z
updated_at: 2026-08-10T21:54:18.122Z
extensions:
  linear:
    id: dcaca6c7-6b64-45aa-8dd7-095d5698f3de
    key: TBD-23
    url: https://linear.app/finterm-ai/issue/TBD-23/self-apply-tbd-setup-to-this-repository
    linked_at: 2026-08-10T19:36:54.896Z
---
Dogfood: build local CLI, run tbd setup --auto, commit refreshed .agents/skills/tbd/SKILL.md, the shrunk format-2 AGENTS.md block, .codex/ hooks, scripts/agent/ shared scripts, and skills/tbd/SKILL.md. Verify idempotent and that quality gates pass.
