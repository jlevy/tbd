---
type: is
id: is-01ksc0scbn4h9eybnfgmvr6mw3
title: Add Codex startup and gh CLI setup parity
kind: task
status: open
priority: 1
version: 4
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
updated_at: 2026-05-24T03:36:28.154Z
---
Audit the current supported Codex project configuration surfaces and implement the best available project-local equivalent to Claude Code's SessionStart/PreCompact tbd prime hook and ensure-gh-cli setup. If Codex still has no executable hook surface, make the fallback explicit in AGENTS.md/SKILL.md/status/doctor so Codex reliably gets tbd prime and setup-github-cli guidance without pretending unsupported hooks exist.
