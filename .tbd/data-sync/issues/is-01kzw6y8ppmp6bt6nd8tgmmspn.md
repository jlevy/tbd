---
type: is
id: is-01kzw6y8ppmp6bt6nd8tgmmspn
title: Polish web table time and column layout
kind: epic
status: closed
priority: 1
version: 19
labels:
  - web
  - release-readiness
dependencies: []
child_order_hints:
  - is-01kzw6ynhk7g7547xaw43pm26g
  - is-01kzw6ynzeydde58fa6q97xnwr
  - is-01kzw6ypc6h8pkjs1hdaqtpyxw
  - is-01kzw8ee5x53dqyske7ycvzkyc
  - is-01kzw93e83wnk699cjem1wz76c
  - is-01kzw93emdr4zjsfatr6t9vp73
  - is-01kzw95g87hwwn7bbx77x0atf1
  - is-01kzw99hbw2k6nj9dgqsd09xq8
  - is-01kzwem8emw6k4797akbkdq4xb
  - is-01kzwfnmyscjkk1g4p1hh99r8j
  - is-01kzwfnmysbzgmvne4sk4tm2py
  - is-01kzwfnmytmhxaeacngc8dj94h
created_at: 2026-08-13T00:04:20.821Z
updated_at: 2026-08-13T02:43:38.984Z
closed_at: 2026-08-13T02:43:38.983Z
close_reason: "All 12 release-readiness children are implemented, documented, reviewed, tested, benchmarked, and live-browser validated on PR #209."
---
Polish the live read-only bead table before the next minor release. Scope: add a standard relative updated-time column with exact timestamp hover and semantic blue age ramp; freeze table column geometry across collapsed and expanded rows; and rebalance title versus label widths so titles wrap cleanly while tags receive useful space. Update the authoritative design-system comments in packages/tbd/src/web/styles.css and verify behavior in the live browser.

## Notes

Implementation started on codex/release-readiness-0.5.0 for PR #209. MetaBrowser reference: static/app.js::formatAge/formatTimestamp and static/styles.css file-age tier design. tbd adaptation keeps the same deterministic tier boundaries while using a blue-only age family; fixed table geometry will use a semantic colgroup and table-layout fixed.

Reopened: A final automated review found a boundary-rounding defect in the new relative-age formatter; reopening the epic to track and fix it before merge.

Reopened: Two additional live-browser findings need release-readiness work: consistent wrapped tree continuation glyphs and a dynamic counted label multi-chooser.
