---
type: is
id: is-01ksc0sv2xc7j6wnb9xzsep7fg
title: Align CLI agent skill guidelines with implementation
kind: task
status: open
priority: 1
version: 6
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels:
  - guidelines
  - agent-skills
dependencies:
  - type: blocks
    target: is-01ksc0thbsjf1629exkpyd5xn7
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T03:35:02.492Z
updated_at: 2026-05-25T23:39:39.078Z
---
packages/tbd/docs/guidelines/cli-agent-skill-patterns.md. Reconcile remaining drift after impl lands (paths, Codex hook events, flag names, format-version guard, Tier-1 vs Tier-2 model, shared-script pattern). Much already updated in this PR; finalize to match shipped behavior.

## Notes

Include downstream pprose lessons: pinned CLI runner fallback patterns, AGENTS.md should be described as Codex/Factory.ai/Cursor-compatible rather than Codex-only, and Codex hook docs should be explicit instead of being implied by Claude hook sections.
