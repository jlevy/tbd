---
type: is
id: is-01ksdpr4q999zpz14nqmv3ycpz
title: Add --surfaces=<list> setup selector (replaces per-agent flags)
kind: task
status: open
priority: 2
version: 6
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels:
  - setup
  - agent-skills
dependencies:
  - type: blocks
    target: is-01ksc0ta2n1q3nkr2791574t56
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T19:17:49.928Z
updated_at: 2026-08-10T21:54:21.863Z
extensions:
  linear:
    id: f7872fb4-7472-46cb-8633-9577779a690c
    key: TBD-20
    url: https://linear.app/finterm-ai/issue/TBD-20/add-surfaceslist-setup-selector-replaces-per-agent-flags
    linked_at: 2026-08-10T19:37:03.252Z
---
setup.ts setupCommand (line 1830). Add --all, --claude, --codex, --agents-md and --no-<surface> options; define interaction with --auto and config defaults (SetupDefaultHandler dispatch line 1838). --auto keeps detection-based default; explicit flags force or suppress a surface.

## Notes

Rescoped 2026-06-02 (PR #156): replace --all/--claude/--codex/--skip-* with a single --surfaces=<comma-list> selector, default = all surfaces. Back with a Surface[] registry (id, displayName, install) replacing the fixed {claude,codex} resolveTargeting and the setupClaudeIfDetected/setupCodexIfDetected methods. Split agents-md into its own surface (was bundled in codex). Surface IDs: portable, agents-md, claude, codex. See spec Setup Behavior + Resolved Decisions (2026-06-02). TDD.
