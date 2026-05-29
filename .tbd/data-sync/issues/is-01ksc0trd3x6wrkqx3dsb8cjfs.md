---
type: is
id: is-01ksc0trd3x6wrkqx3dsb8cjfs
title: Validate ecosystem compatibility and release metadata
kind: task
status: open
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels:
  - validation
  - release
dependencies: []
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T03:35:32.514Z
updated_at: 2026-05-25T23:39:39.920Z
---
Run skills-ref validate skills/tbd and npx skills add . --list; smoke-test Claude Code + Codex (and Gemini/Cursor where feasible); add release notes calling out the portable .agents/skills path, Codex hooks, and the format-version guard.
