---
type: is
id: is-01kyt5y067sbrn8ws496ane8qg
title: "PR #196 review N4: stale-local --bead validation lacks tbd sync hint"
kind: bug
status: closed
priority: 2
version: 2
labels: []
dependencies: []
parent_id: is-01kyt5x6y2h4d3x7b68jjr6n2j
created_at: 2026-07-30T18:52:32.839Z
updated_at: 2026-07-30T19:12:33.303Z
closed_at: 2026-07-30T19:12:33.303Z
close_reason: "Fixed in f71b1cf on PR #196; CI green"
---
validateBeadSelectionAtRef (sync-branch-changes.ts:271-280) rejects beads created remotely since last sync with bare 'Unknown issue ID'. Append run-tbd-sync hint on this local-snapshot path only. PR #196
