---
type: is
id: is-01kzw6ynhk7g7547xaw43pm26g
title: Add semantic relative updated-time column
kind: task
status: closed
priority: 1
version: 3
labels:
  - web
  - release-readiness
dependencies: []
parent_id: is-01kzw6y8ppmp6bt6nd8tgmmspn
created_at: 2026-08-13T00:04:33.969Z
updated_at: 2026-08-13T00:18:31.470Z
closed_at: 2026-08-13T00:18:31.469Z
close_reason: Implemented and validated the Updated column with shared relative-time formatting, exact ISO hover metadata, six semantic blue age tiers, and periodic refresh.
---
Expose Issue.updated_at on BoardRow in packages/tbd/src/cli/web/board.ts::toRow and packages/tbd/src/web/core.ts::BoardRowView. Add a pure formatter in web/core.ts using MetaBrowser’s six boundaries (<1m, minutes, hours, days, weeks, months/years) and age-tier classification. Render a <time> cell in web/client.ts with compact human-readable text, machine-readable datetime, and exact ISO tooltip; refresh labels on a single shared interval rather than per-row timers. Add an Updated header/colgroup entry in web/index.html, blue-family light/dark tokens and age classes plus design-system documentation in web/styles.css, and focused unit/CSS/server tests.

## Notes

Implementation started on codex/release-readiness-0.5.0 for PR #209. MetaBrowser reference: static/app.js::formatAge/formatTimestamp and static/styles.css file-age tier design. tbd adaptation keeps the same deterministic tier boundaries while using a blue-only age family; fixed table geometry will use a semantic colgroup and table-layout fixed.
