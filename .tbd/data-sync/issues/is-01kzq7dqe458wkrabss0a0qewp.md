---
type: is
id: is-01kzq7dqe458wkrabss0a0qewp
title: Prevent stale expanded web bead body after a data wake
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
created_at: 2026-08-11T01:36:35.267Z
updated_at: 2026-08-11T04:42:43.414Z
closed_at: 2026-08-11T04:42:43.414Z
close_reason: Fixed in 6edccb89; full gate green; threads replied and resolved on PR 207
---
In PR 207, an expanded bead body request can be in flight when an SSE data wake clears the cache and requests a forced reload. loadBody returns because the id is already in inFlight; the old response can then repopulate the cache with pre-wake data and no newer request is scheduled. Capture a data-version or request generation, abort/restart, or discard stale responses, and cover the race in a client test.
