---
type: is
id: is-01kzq9697jy6nbmjrm53whb8dm
title: "PR #207 senior review R4: pendingQuery dedup drops wake refreshes; board goes stale"
kind: bug
status: closed
priority: 2
version: 2
labels:
  - viewer
dependencies: []
created_at: 2026-08-11T02:07:28.497Z
updated_at: 2026-08-11T04:42:43.393Z
closed_at: 2026-08-11T04:42:43.393Z
close_reason: Fixed in 6edccb89; full gate green; threads replied and resolved on PR 207
---
Senior review R4 (HIGH) = Bugbot 3753568097: refresh() returns when pendingQuery equals the current query string, so a wake during an in-flight identical request never refetches and the live table stays stale until user input. Fix: in-flight flag + queued refresh + re-issue when filters changed during flight; generation counter so only the latest response applies.
