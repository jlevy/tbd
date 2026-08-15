---
type: is
id: is-01kzwvymmkpcn3rg7tfz4dhqc1
title: "PR #209 review S8: Expose Pretty rolled-up updated timestamp"
kind: task
status: open
priority: 2
version: 4
labels:
  - review
  - web
  - followup
  - pause
dependencies: []
parent_id: null
created_at: 2026-08-13T06:11:33.138Z
updated_at: 2026-08-15T05:44:05.546Z
---
PR #209 senior review S8. packages/tbd/src/cli/web/board.ts orderAsTree sorts roots by subtree-recency rollup but toRow displays only each parent's own updated_at. Annotate parent roots or expose the rollup so visible data explains ordering, with exact-date tooltip and tests.

## Notes

Disposition: deferred, non-blocking. The rolled-up Updated value is already documented in the header and equivalent-command caveat; displaying a second derived timestamp needs a separate visual and accessibility design. Keep for a focused follow-up.
