---
type: is
id: is-01kzn5wbxkb6c0db6k19wj7yzj
title: "Spec: tbd web — production-ready live bead view"
kind: epic
status: open
priority: 1
version: 26
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - viewer
dependencies: []
child_order_hints:
  - is-01kzq6hcbgh58y4sv88g74q3n0
  - is-01kzq7dpztf9sy32xaxf63apwg
  - is-01kzq7dqe458wkrabss0a0qewp
  - is-01kzq6vbaqck3q21a69965ha4e
  - is-01kzrs2jrjg3pzase83ebxdjyg
  - is-01kzrs66v8et3vwh2tpmk3v9d9
  - is-01kzrs6dd1abehychzed2yc1fk
  - is-01kzrs6s3fn7gtzgt70wx9yzas
  - is-01kzrs779s8d2t4qmvpx310p22
created_at: 2026-08-10T06:31:08.978Z
updated_at: 2026-08-11T20:30:16.516Z
closed_at: null
close_reason: null
extensions:
  linear:
    id: 87a13af9-a3b4-4897-873a-f8bfeb82fa65
    key: TBD-78
    url: https://linear.app/finterm-ai/issue/TBD-78/land-tbd-web-spike-pr-stacked-on-pr-205
    linked_at: 2026-08-10T19:37:39.540Z
---
Deliver PR #207 to the approved merge bar in docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md: a packaged, loopback-only, read-only tbd web command with shared query semantics, live in-process wake handling, a strict TypeScript client, complete docs, and production validation.

## Notes

All original tbd web phases plus the owner-requested 10k scale follow-up are implemented. The response ceiling is 10,000 with 1,000-row pages and independently bounded detail/cache/motion work; 17 final-review findings are closed or represented by the active landing child. Exact-tree local CI and packed artifact proof pass. Awaiting the pushed-head GitHub matrix and final mergeability audit before re-closing the epic.
