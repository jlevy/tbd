---
type: is
id: is-01m0c5qm44fxj4m6tr29k2v29f
title: "Phase 3: slots in the reconcile engine"
kind: task
status: open
priority: 3
version: 4
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
labels: []
dependencies:
  - type: blocks
    target: is-01m0c5qw38xxxfgr8grwwnyz7x
parent_id: is-01m0bahns9883ea2cn8ajgnf99
created_at: 2026-08-19T04:51:05.475Z
updated_at: 2026-08-19T16:27:16.091Z
extensions:
  linear:
    id: d005ac9a-ad75-4650-8b5b-24e64457e609
    linked_at: 2026-08-19T16:27:16.091Z
---
Widen the reconcile canonical status field from the five-value enum to the slot vocabulary (backlog|draft|todo|in_progress|paused|blocked|in_review|done|canceled|duplicate). Legacy path with no state_map keeps statusToLinear/statusFromLinear byte-for-byte.

Local slot computation by the fixed precedence ladder; pull decomposition back onto bead fields; remote slot resolution by name, with unmapped names becoming owned refinements (band slot for the matrix, exact state id preserved outbound). Settle the refinement record's home (extensions.<provider> vs the pair's link record) by testing two clones against one team. Base migration on first slot run: zero writes on an unchanged repository, pinned by test. Outbound ladder: mapped state, else carrier label plus band default, else band default.

Depends on Phase 1's resolver and Phase 2's hold fields.
