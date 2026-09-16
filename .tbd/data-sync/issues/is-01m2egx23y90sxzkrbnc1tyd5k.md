---
type: is
id: is-01m2egx23y90sxzkrbnc1tyd5k
title: Sync selectors scope the linked set, fetch, creates, and replay in every mode
kind: feature
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-1
dependencies:
  - type: blocks
    target: is-01m2egx888wh2r62pt8ce4d3wz
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-13T23:16:10.489Z
updated_at: 2026-09-16T08:24:08.743Z
extensions:
  linear:
    id: a2733920-36d1-453c-b1c7-76e187d86c82
    linked_at: 2026-09-16T08:24:08.743Z
---
Selectors (--bead, --type, --status, --label, --spec, --limit) are legal only with --push today (integration.ts:879-882), and the reconciler cannot be scoped: it fetches every linked pair (sync-engine.ts:591-616) and replays every intent (:435). Make selectors scope the linked set, the remote fetch, creates, and replay (the shouldReplay hook exists at :443) in every mode, so the bulk-guard remedy's `--bead`/`--limit` advice works for the bare sync. Depends on the one-planner bead.
