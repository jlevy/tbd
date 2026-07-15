---
type: is
id: is-01kxj32x4qe3m6xh137axnjv68
title: Separate setup preview from apply and eliminate all dry-run writes
kind: task
status: open
priority: 1
version: 4
labels:
  - setup
  - dry-run
  - bug
dependencies:
  - type: blocks
    target: is-01kxj32xg2qpdfb73qsg9pnt4s
  - type: blocks
    target: is-01kxj32xtn7978fy1cw6f61qca
parent_id: is-01kxj32wgrjfa51wytr33z286r
created_at: 2026-07-15T05:13:10.551Z
updated_at: 2026-07-15T05:13:54.168Z
---
Make the new full-state dry-run tests pass with an explicit preflight/plan/apply boundary.

Acceptance criteria:
- No dry-run writes to config version/history, migrated config, .tbd gitignore/gitattributes, docs cache, local state, common-dir layout/worktree state, agent skills, AGENTS.md, hooks, scripts, or legacy cleanup targets.
- Thread dryRun through docs sync and any helper that must compute a preview, or skip mutation behind a top-level plan while preserving accurate reporting.
- Validate forward-compatibility and input errors during preview without partially applying earlier operations.
- Fresh setup and already-initialized setup both obey the same no-side-effect contract.
- Normal non-dry-run setup behavior, idempotence, migration, version stamping, and output remain covered.
- Errors remain actionable and nonzero; success is reported only after actual apply verification.
