---
type: is
id: is-01ky1fadtxh96k24g9f0ht75eb
title: "PR #196 review R1: watch --bead does not fail fast on unknown IDs"
kind: bug
status: closed
priority: 1
version: 3
labels:
  - pr196-review
dependencies: []
parent_id: is-01ky1f9xcbb3qas6ex5v7hda0k
created_at: 2026-07-21T04:35:36.413Z
updated_at: 2026-07-21T04:48:28.385Z
closed_at: 2026-07-21T04:48:28.385Z
close_reason: "Fixed in 52867bd: beads-kind watch without --since does one startup fetch + tip-to-tip report; unknown IDs reject before the poll loop. Unit + e2e tests added."
---
tbd watch --bead tbd-TYPO without --since performs no initial report; IDs resolve only inside createIssueChangesReport after the first remote movement, so a typo blocks silently for hours. packages/tbd/src/file/bead-watch.ts:119-147, packages/tbd/src/lib/issue-changes.ts:212-227. Fix: pre-resolve beads-kind selections at watch startup against the first observed tip (fetch) and exit 1 on unknown IDs before entering the poll loop.
