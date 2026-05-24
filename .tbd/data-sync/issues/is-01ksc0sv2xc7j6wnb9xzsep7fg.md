---
type: is
id: is-01ksc0sv2xc7j6wnb9xzsep7fg
title: Align CLI agent skill guidelines with implementation
kind: task
status: open
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels:
  - guidelines
  - agent-skills
dependencies:
  - type: blocks
    target: is-01ksc0thbsjf1629exkpyd5xn7
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T03:35:02.492Z
updated_at: 2026-05-24T19:18:10.035Z
---
Revise packages/tbd/docs/guidelines/cli-agent-skill-patterns.md so it matches the implementation and current best practices: .agents/skills as canonical portable path, .claude/skills as Claude mirror, AGENTS.md as always-on instructions, Cursor/Gemini/Codex behavior, copy-vs-symlink policy, hook/startup limitations, generated-file ownership, and validation guidance.

## Notes

Include downstream pprose lessons: pinned CLI runner fallback patterns, AGENTS.md should be described as Codex/Factory.ai/Cursor-compatible rather than Codex-only, and Codex hook docs should be explicit instead of being implied by Claude hook sections.
