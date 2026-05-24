---
type: is
id: is-01ksdpqxp1bavjc60s2wynfawb
title: Document pinned CLI runner fallback patterns
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels:
  - guidelines
  - security
  - setup
dependencies:
  - type: blocks
    target: is-01ksc0sv2xc7j6wnb9xzsep7fg
  - type: blocks
    target: is-01ksc0ta2n1q3nkr2791574t56
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T19:17:42.717Z
updated_at: 2026-05-24T19:18:25.545Z
---
Extend tbd's CLI-as-agent-skill guidance with pprose-style pinned command fallbacks for non-npm CLIs: local command first, then pinned zero-install runner such as uvx --from pkg@<install-time-version>, pipx run pkg==<version>, or go run module@<version>. Include supply-chain guidance: never recommend unpinned runners in generated skill instructions.
