---
type: is
id: is-01kzq7dpztf9sy32xaxf63apwg
title: Fix web client board-fetch ordering and SSE state rollback races
kind: bug
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - pr-207
dependencies: []
parent_id: is-01kzn5wbxkb6c0db6k19wj7yzj
created_at: 2026-08-11T01:36:34.809Z
updated_at: 2026-08-11T04:42:43.407Z
closed_at: 2026-08-11T04:42:43.407Z
close_reason: Fixed in 6edccb89; full gate green; threads replied and resolved on PR 207
---
PR 207 has three unresolved review threads in bead-web.html around refresh(): a same-query wake can be dropped while a request is pending, out-of-order responses can replace the active query result, and a board response can overwrite a newer SSE WatchState. Use an abort/generation/queued-refresh design and keep SSE state monotonic. Add transport-level client tests.
