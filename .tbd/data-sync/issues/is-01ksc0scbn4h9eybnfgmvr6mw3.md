---
type: is
id: is-01ksc0scbn4h9eybnfgmvr6mw3
title: Add Codex startup and gh CLI setup parity
kind: task
status: open
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels:
  - codex
  - hooks
  - setup
dependencies:
  - type: blocks
    target: is-01ksc0skpmwe30svw66fjsztwg
  - type: blocks
    target: is-01ksc0sv2xc7j6wnb9xzsep7fg
  - type: blocks
    target: is-01ksc0ta2n1q3nkr2791574t56
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T03:34:47.412Z
updated_at: 2026-05-24T19:18:03.940Z
---
Audit official Codex project hook support and implement Codex parity for tbd prime, gh CLI setup, and close-protocol reminders. Use project-local .codex/ hooks/config or shared agent script paths; do not make Codex hooks depend on .claude/scripts/. If Codex lacks a direct event equivalent, document the limitation in AGENTS.md, SKILL.md, status, and doctor rather than inventing unsupported behavior.

## Notes

Downstream pprose audit called out cross-tree coupling as a risk: Codex hooks should not call .claude/scripts/tbd-session.sh. Verify current tbd behavior against official Codex hooks docs before implementation.
