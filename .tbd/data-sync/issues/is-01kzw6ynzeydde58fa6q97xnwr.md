---
type: is
id: is-01kzw6ynzeydde58fa6q97xnwr
title: Keep bead table columns stable during expansion
kind: task
status: closed
priority: 1
version: 3
labels:
  - web
  - release-readiness
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T00:04:34.413Z
updated_at: 2026-08-13T00:18:31.787Z
closed_at: 2026-08-13T00:18:31.786Z
close_reason: Implemented a fixed eight-column colgroup; browser measurements remain identical across expansion and detail content aligns with the ID column.
---
Define the board table’s column contract in packages/tbd/src/web/index.html and styles.css using a semantic colgroup and fixed table layout. Ensure expanded detail rows and pager rows span the new complete column count without allowing long detail content to resize headers or ordinary rows. Preserve horizontal overflow and responsive behavior. Add CSS/DOM contract tests and visually compare collapsed versus expanded geometry.

## Notes

Implementation started on codex/release-readiness-0.5.0 for PR #209. MetaBrowser reference: static/app.js::formatAge/formatTimestamp and static/styles.css file-age tier design. tbd adaptation keeps the same deterministic tier boundaries while using a blue-only age family; fixed table geometry will use a semantic colgroup and table-layout fixed.
