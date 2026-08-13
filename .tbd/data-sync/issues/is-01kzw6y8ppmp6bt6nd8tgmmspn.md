---
type: is
id: is-01kzw6y8ppmp6bt6nd8tgmmspn
title: Polish web table time and column layout
kind: epic
status: closed
priority: 1
version: 6
labels:
  - web
  - release-readiness
dependencies: []
child_order_hints:
  - is-01kzw6ynhk7g7547xaw43pm26g
  - is-01kzw6ynzeydde58fa6q97xnwr
  - is-01kzw6ypc6h8pkjs1hdaqtpyxw
created_at: 2026-08-13T00:04:20.821Z
updated_at: 2026-08-13T00:18:32.340Z
closed_at: 2026-08-13T00:18:32.339Z
close_reason: All child work implemented; 1606-test CI and live browser validation pass, with no runtime warnings or errors.
---
Polish the live read-only bead table before the next minor release. Scope: add a standard relative updated-time column with exact timestamp hover and semantic blue age ramp; freeze table column geometry across collapsed and expanded rows; and rebalance title versus label widths so titles wrap cleanly while tags receive useful space. Update the authoritative design-system comments in packages/tbd/src/web/styles.css and verify behavior in the live browser.

## Notes

Implementation started on codex/release-readiness-0.5.0 for PR #209. MetaBrowser reference: static/app.js::formatAge/formatTimestamp and static/styles.css file-age tier design. tbd adaptation keeps the same deterministic tier boundaries while using a blue-only age family; fixed table geometry will use a semantic colgroup and table-layout fixed.
