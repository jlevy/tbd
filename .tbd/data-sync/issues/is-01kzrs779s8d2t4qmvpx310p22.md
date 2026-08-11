---
type: is
id: is-01kzrs779s8d2t4qmvpx310p22
title: "Phase 6: validate and land production tbd web end to end"
kind: task
status: open
priority: 1
version: 10
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - validation
  - web
  - pr-207
dependencies: []
parent_id: is-01kzn5wbxkb6c0db6k19wj7yzj
child_order_hints:
  - is-01kzrsac4r354tm2b2f89mg0ve
  - is-01kzrsajhday2nyvfnbk2c097t
  - is-01kzrsarka5sq9h3x8v5yp7vpm
  - is-01kzs5fg2amah8bnpy3mct8khd
created_at: 2026-08-11T16:06:50.935Z
updated_at: 2026-08-11T20:30:16.217Z
closed_at: null
close_reason: null
extensions:
  linear:
    id: 9437aa72-43f0-46bf-87b9-cc8a023e198e
    linked_at: 2026-08-11T16:24:42.170Z
    key: TBD-138
    url: https://linear.app/finterm-ai/issue/TBD-138/phase-6-validate-and-land-production-tbd-web-end-to-end
---
Run the full local/CI matrix, 5k performance and payload bounds, Git isolation checks, packaged-tarball proof, lifecycle/manual smoke, final merge from main, PR metadata update, final review disposition, and merge-readiness verification.

## Notes

Reopened for the owner-requested first-principles 4k/5k/10k ceiling review. The resulting 10k paged implementation and three scale findings are complete; exact-tree local CI is green at 110 files / 1,503 tests and packed artifact validation passes. Awaiting commit/push, hosted Ubuntu/macOS/Windows matrix, refreshed PR metadata/comment audit, and final mergeability verification.
