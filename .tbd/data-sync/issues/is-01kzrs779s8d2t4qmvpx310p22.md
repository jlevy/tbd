---
type: is
id: is-01kzrs779s8d2t4qmvpx310p22
title: "Phase 6: validate and land production tbd web end to end"
kind: task
status: closed
priority: 1
version: 17
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
updated_at: 2026-08-12T00:09:11.259Z
closed_at: 2026-08-12T00:09:11.258Z
close_reason: End-to-end local/hosted validation and PR readiness gate complete on 2a7a7d44.
extensions:
  linear:
    id: 9437aa72-43f0-46bf-87b9-cc8a023e198e
    linked_at: 2026-08-11T16:24:42.170Z
    key: TBD-138
    url: https://linear.app/finterm-ai/issue/TBD-138/phase-6-validate-and-land-production-tbd-web-end-to-end
---
Run the full local and hosted matrix, 10,000-row performance and payload bounds, Git isolation checks, packed-tarball proof, lifecycle/manual smoke, final base integration, PR metadata update, final review disposition, comment audit, and merge-readiness verification.

## Notes

Final end-to-end validation complete on 2a7a7d44. Local pnpm run ci and repeated pre-push gates pass 109 files / 1,508 tests plus formatting, Flowmark, strict dual typecheck, zero-warning lint, build, and 31 package-age pins. Tryscript 1,074, publint, 62,196-byte packed web proof, watch release smoke, two-clone explicit-sync/SSE acceptance, 10,000-row board and 1,000-row client bounds all pass. Hosted exact-head run 31548603423 is green on Ubuntu 2m29, macOS 3m55, Windows 5m11, Coverage and Lint 6m48, Benchmark 25s, Bugbot, and DeepSource secret scan. All 12 threads resolved; PR OPEN, non-draft, MERGEABLE, CLEAN.
