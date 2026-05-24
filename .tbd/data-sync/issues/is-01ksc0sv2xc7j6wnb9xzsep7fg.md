---
type: is
id: is-01ksc0sv2xc7j6wnb9xzsep7fg
title: Align CLI agent skill guidelines with implementation
kind: task
status: open
priority: 1
version: 2
labels:
  - guidelines
  - agent-skills
dependencies:
  - type: blocks
    target: is-01ksc0thbsjf1629exkpyd5xn7
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T03:35:02.492Z
updated_at: 2026-05-24T03:36:31.443Z
---
Revise packages/tbd/docs/guidelines/cli-agent-skill-patterns.md so it matches the implementation and current best practices: .agents/skills as canonical portable path, .claude/skills as Claude mirror, AGENTS.md as always-on instructions, Cursor/Gemini/Codex behavior, copy-vs-symlink policy, hook/startup limitations, generated-file ownership, and validation guidance.
