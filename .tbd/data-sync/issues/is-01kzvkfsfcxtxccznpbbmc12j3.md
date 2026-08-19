---
type: is
id: is-01kzvkfsfcxtxccznpbbmc12j3
title: Make bulk expansion copy accurately page-scoped
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - review
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T18:24:23.531Z
updated_at: 2026-08-12T18:29:32.358Z
closed_at: 2026-08-12T18:29:32.356Z
close_reason: null
---
Late PR review thread PRRT_kwDOQ109P86YrKUK notes that Expand all/Collapse all operates on paginateBoardRows but its label or tooltip claims the whole current result. Make the UI copy explicitly page-scoped and protect it with a regression test.
