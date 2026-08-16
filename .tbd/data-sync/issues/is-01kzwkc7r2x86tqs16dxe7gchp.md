---
type: is
id: is-01kzwkc7r2x86tqs16dxe7gchp
title: Compact latest-change field diffs and suppress created-value noise
kind: feature
status: closed
priority: 1
version: 5
labels:
  - web
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T03:41:41.505Z
updated_at: 2026-08-13T04:06:22.920Z
closed_at: 2026-08-13T04:06:22.920Z
close_reason: Implemented, covered by focused tests, documented in the authoritative web design and user docs, passed the full 1,626-test CI suite, and validated in the live browser.
---
File/function detail:\n- packages/tbd/src/web/client.ts latest-change rendering: truncate each rendered before/after value at one fixed documented character limit with an ellipsis while retaining access to the exact full literal; give before a muted role and after the normal literal role.\n- Created beads must not render null-to-value field hunks because creation already conveys the event and current expanded data contains the values.\n- packages/tbd/src/web/styles.css: encode before/after roles with existing design tokens.\n- Core/board tests and CSS tests: cover cutoff boundary, full value access, before/after roles, and created-event suppression.\n- Authoritative design docs: state the cutoff and event rule.

## Notes

Implemented an 80-character middle-ellipsis preview for each scalar before and after value, preserved the bounded full change in Copy, muted historical values, retained normal text for current values, and suppressed redundant expanded deltas for newly created beads.
