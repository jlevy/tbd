---
type: is
id: is-01kzrs779s8d2t4qmvpx310p22
title: "Phase 6: validate and land production tbd web end to end"
kind: task
status: open
priority: 1
version: 15
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
  - is-01kzscf4fdjf02qjcvedyp7ekx
created_at: 2026-08-11T16:06:50.935Z
updated_at: 2026-08-11T23:05:16.195Z
closed_at: null
close_reason: null
extensions:
  linear:
    id: 9437aa72-43f0-46bf-87b9-cc8a023e198e
    linked_at: 2026-08-11T16:24:42.170Z
    key: TBD-138
    url: https://linear.app/finterm-ai/issue/TBD-138/phase-6-validate-and-land-production-tbd-web-end-to-end
---
Run the full local and hosted matrix, 10,000-row performance and payload bounds, Git isolation checks, packed-tarball proof, lifecycle/manual smoke, final base integration, PR metadata update, final review disposition, comment audit, and merge-readiness verification.

## Notes

Final validation complete on 50f895fb. Exact-tree local CI passes 110 files / 1,503 tests; tryscript has 1,074 passing checks; publint, 31 package-age pins with 0 violations, packed-web proof at 60,937 bytes, browser acceptance, lifecycle/security, and platform checks pass. Hosted run 31535582219 is green on Ubuntu, macOS, Windows, coverage/lint, benchmark, Bugbot, and secret scanning. All 10 review threads are resolved. origin/main is integrated and GitHub reports OPEN, non-draft, MERGEABLE, CLEAN.

Reopened: Owner-directed contract revision: make tbd web local-only and move all remote synchronization back to standard tbd sync.
