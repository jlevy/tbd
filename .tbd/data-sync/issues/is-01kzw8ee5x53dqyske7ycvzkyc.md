---
type: is
id: is-01kzw8ee5x53dqyske7ycvzkyc
title: Prevent relative-age labels from crossing color-tier boundaries
kind: bug
status: closed
priority: 2
version: 3
labels:
  - web
  - release-readiness
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T00:30:39.292Z
updated_at: 2026-08-13T00:35:58.241Z
closed_at: 2026-08-13T00:35:58.239Z
close_reason: Fixed the final PR review finding with monotonic floor-based relative-age quantities and just-below/exact-boundary regressions; focused test and full 1606-test CI pass.
---
Address the final PR #209 review thread in packages/tbd/src/web/core.ts::formatRelativeAge. The unit-selection thresholds and displayed quantity must agree near 60m/24h/7d boundaries; labels must never render 60m, 24h, or 7d in the preceding age tier. Add exact boundary-adjacent regression cases in packages/tbd/tests/web-core.test.ts, implement the smallest deterministic fix, rerun full CI, resolve the review thread, and resync the epic.

## Notes

Confirmed actionable on final commit e679b225: Math.round can emit 60m/24h/7d while the tier still indicates min/hr/day. Use monotonic floor quantities with focused just-below/exact-boundary tests.
