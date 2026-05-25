---
type: is
id: is-01ksc0skpmwe30svw66fjsztwg
title: Update setup check remove status and doctor
kind: task
status: open
priority: 1
version: 5
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels:
  - setup
  - diagnostics
dependencies:
  - type: blocks
    target: is-01ksc0ta2n1q3nkr2791574t56
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T03:34:54.931Z
updated_at: 2026-05-25T23:39:38.801Z
---
Expose --check/--remove at setupCommand level (currently not wired). Extend checkClaudeSetup (line 384), removeClaudeSetup (line 564), checkCodexSetup (line 858), removeCodexSection (line 903), doctor checkClaudeSkill (line 779) + checkCodexAgents (line 795), status checkIntegrations (line 191): report portable .agents skill, Claude mirror, AGENTS block state (current/legacy-upgradable/unmarked/format-too-new), Claude hooks, Codex hooks, gh-cli. --remove strips tbd-owned incl .agents/skills and .codex while preserving user content outside markers.
