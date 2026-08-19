---
type: is
id: is-01kzw6ypc6h8pkjs1hdaqtpyxw
title: Rebalance title and label widths with correct wrapping
kind: task
status: closed
priority: 1
version: 3
labels:
  - web
  - release-readiness
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T00:04:34.821Z
updated_at: 2026-08-13T00:18:32.068Z
closed_at: 2026-08-13T00:18:32.067Z
close_reason: Rebalanced the fixed grid to 29% title and 22% labels, capped description growth, and preserved correct wrapping.
---
Cap the title column’s share of the fixed board grid and give labels a larger explicit allocation in packages/tbd/src/web/styles.css/index.html. Keep pretty-tree hanging indents and ancestor continuation lines correct when titles wrap; keep tag chips whole and wrap only between tags. Add regression assertions for semantic column sizing and validate narrow and wide layouts.

## Notes

Implementation started on codex/release-readiness-0.5.0 for PR #209. MetaBrowser reference: static/app.js::formatAge/formatTimestamp and static/styles.css file-age tier design. tbd adaptation keeps the same deterministic tier boundaries while using a blue-only age family; fixed table geometry will use a semantic colgroup and table-layout fixed.
