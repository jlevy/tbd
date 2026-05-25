---
type: is
id: is-01ksc0scbn4h9eybnfgmvr6mw3
title: Add Codex startup and gh CLI setup parity
kind: task
status: open
priority: 1
version: 9
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
  - type: blocks
    target: is-01ksgr45bkhqwwfhpna2xytqdz
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T03:34:47.412Z
updated_at: 2026-05-25T23:39:40.785Z
---
setup.ts. Add Codex hook install writing .codex/hooks.json (or inline [hooks] in .codex/config.toml): SessionStart->tbd prime, PreCompact->tbd prime --brief, PostToolUse(git push)->closing reminder, SessionStart->ensure gh. Codex uses the SAME event schema as Claude (verified May 2026; command handlers only) so the mapping is ~1:1. Relocate shared scripts from .claude/scripts/ to scripts/agent/ (TBD_SESSION_SCRIPT line 126, TBD_CLOSE_PROTOCOL_SCRIPT line 250, ensure-gh-cli.sh); update CLAUDE_SESSION_HOOKS (line 210) and CLAUDE_PROJECT_HOOKS (line 231) commands to reference shared paths (or wrapper) so existing Claude hooks keep working. Codex hooks must not reference .claude/.

## Notes

Downstream pprose audit called out cross-tree coupling as a risk: Codex hooks should not call .claude/scripts/tbd-session.sh. Verify current tbd behavior against official Codex hooks docs before implementation.
