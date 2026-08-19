---
type: is
id: is-01kzsjvx0n0zpjj9tdrxcj6m2p
title: Reconcile expanded rows across display-ID remaps
kind: bug
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - client-state
dependencies: []
parent_id: is-01kzscf4fdjf02qjcvedyp7ekx
created_at: 2026-08-11T23:35:02.932Z
updated_at: 2026-08-12T00:09:10.567Z
closed_at: 2026-08-12T00:09:10.566Z
close_reason: Fixed in 152caa48; display-ID remap regression covered and final hosted matrix green.
---
PR review thread PRRT_kwDOQ109P86YZ9Vd found that BoardState correctly reports display-ID remaps as movement, but the browser retains expanded/body state under obsolete IDs and refetches those IDs before the canonical board arrives. Reconcile expanded rows by stable internalId when the accepted board crosses a graph version, drop vanished/hidden stale entries, and start replacement body requests only after canonical rows identify their current display IDs. Add a regression and document as R23.

## Notes

R23 complete in 152caa48: after graph motion, body generation is invalidated, canonical board refresh maps expanded display IDs through stable internalId, and replacement body requests begin only for current IDs. Focused web-core/web-board 24/24; full local gate 109 files / 1,508 tests; hosted implementation run 31547701354 and exact final run 31548603423 green. Original thread auto-resolved after the fix.
