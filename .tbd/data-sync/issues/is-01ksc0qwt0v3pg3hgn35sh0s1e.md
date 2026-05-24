---
type: is
id: is-01ksc0qwt0v3pg3hgn35sh0s1e
title: Modernize multi-agent skills and hooks setup
kind: epic
status: open
priority: 1
version: 13
labels:
  - agent-skills
  - setup
  - codex
dependencies: []
child_order_hints:
  - is-01ksc0rn3yew49ga59qp1v2mk8
  - is-01ksc0rw9r8p9kxxx1b4rnpyjn
  - is-01ksby3fdgasqh37gd81zees15
  - is-01ksc0s4vq2w1yyp10fybqpq8t
  - is-01ksc0scbn4h9eybnfgmvr6mw3
  - is-01ksc0skpmwe30svw66fjsztwg
  - is-01ksc0sv2xc7j6wnb9xzsep7fg
  - is-01ksc0t1njfwsxfv86vvgdb4y2
  - is-01ksc0ta2n1q3nkr2791574t56
  - is-01ksc0thbsjf1629exkpyd5xn7
  - is-01ksc0trd3x6wrkqx3dsb8cjfs
created_at: 2026-05-24T03:33:58.719Z
updated_at: 2026-05-24T03:35:58.990Z
---
Bring tbd's own setup behavior and guidelines in line with the current Agent Skills ecosystem and tbd's best practices. Scope: use .agents/skills as the portable Agent Skills install target, keep .claude/skills as a Claude Code compatibility mirror, keep AGENTS.md for always-on instructions, add/confirm Codex-compatible startup and gh CLI setup behavior, ensure generated/project integration files are not accidentally gitignored, update status/doctor/tests, and run tbd setup from the local build to refresh this repository's own checked-in agent integration files.
