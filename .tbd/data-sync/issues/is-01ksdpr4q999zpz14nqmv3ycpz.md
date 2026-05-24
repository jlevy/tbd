---
type: is
id: is-01ksdpr4q999zpz14nqmv3ycpz
title: Add agent-targeted setup flag design
kind: task
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-05-24-multi-agent-skills-hooks-setup.md
labels:
  - setup
  - agent-skills
dependencies:
  - type: blocks
    target: is-01ksc0ta2n1q3nkr2791574t56
parent_id: is-01ksc0qwt0v3pg3hgn35sh0s1e
created_at: 2026-05-24T19:17:49.928Z
updated_at: 2026-05-24T19:18:26.467Z
---
Design setup flag taxonomy for explicit agent targeting, such as --claude, --codex, --cursor, --agents-md, --all, and --no-<agent>. Define how these flags interact with --auto detection and with existing config defaults, without breaking current tbd setup behavior.
