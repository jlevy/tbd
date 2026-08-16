---
type: is
id: is-01kzwj3a66jtae68g448dn8cph
title: Prevent the Updated secondary-sort indicator from clipping
kind: bug
status: closed
priority: 2
version: 3
labels:
  - web
  - release-readiness
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T03:19:20.518Z
updated_at: 2026-08-13T04:06:22.874Z
closed_at: 2026-08-13T04:06:22.874Z
close_reason: Implemented, covered by focused tests, documented in the authoritative web design and user docs, passed the full 1,626-test CI suite, and validated in the live browser.
---
The Updated header's ↓2 secondary-sort indicator is clipped at the right edge in the fixed eight-column grid. Rebalance one percentage point from Title to Updated while preserving the widened Labels allocation, and verify at the table minimum width that every sortable header button's scroll width fits its client width for primary and secondary indicators.

## Notes

Live computed-geometry validation at the fixed grid width found both Updated↓2 (82px content in a 78px box) and P↑1 (30px in 25px) still clipped after the initial one-point change. Final grid must allocate 13% Updated and 7% Priority at the 820px minimum; Title absorbs the four points and Labels remains 22%. Recheck every header scrollWidth <= clientWidth.
