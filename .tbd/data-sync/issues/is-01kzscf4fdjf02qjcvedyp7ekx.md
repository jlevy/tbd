---
type: is
id: is-01kzscf4fdjf02qjcvedyp7ekx
title: Make tbd web a local-only live view
kind: feature
status: in_progress
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - viewer
  - liveness
  - pr-207
dependencies: []
parent_id: is-01kzrs779s8d2t4qmvpx310p22
child_order_hints:
  - is-01kzsfyarhtb3905v3vhwww7ma
  - is-01kzsgeybrzvaxynpcfpsr2mds
created_at: 2026-08-11T21:43:13.132Z
updated_at: 2026-08-11T23:05:16.448Z
---
Remove all implicit remote polling and fetching from tbd web. Observe the hidden data-sync worktree through a native Node filesystem watcher with a one-second reconciliation fallback, so local tbd commands and tbd sync appear promptly. Remove the polling CLI flag and remote-watch/report state, align the UI and every design/user/validation document, test native/degraded/reconciliation behavior cross-platform, and re-run the PR merge gate.

## Notes

Owner contract: tbd web is a strictly local read-only view; only ordinary tbd sync contacts the remote. File/function map: commands/web.ts exposes only port/open; server.ts constructs LocalObserver with no network-capable dependency; local-observer.ts uses recursive native fs.watch, 250 ms trailing debounce, a one-second constant-size stat marker, serialized reloads, independent degraded modes, fresh observer id, monotonic stateVersion, and bounded shutdown; board.ts observes config/workspaces/data/mappings/local-ref metadata, publishes metadata-only changes, computes complete canonical moved/removed ids, and caps diagnostic field detail at 100 changed beads and 256 KiB; issue-changes.ts restricts static bead selections before deep field comparison; http.ts uses ref-rewind-safe/current-state replay, bounded frames, explicit queued-byte backpressure, and per-client closed-stream isolation; web/core.ts rejects stale or duplicate event state while allowing canonical same-version board recovery and observer restarts; client.ts explains explicit sync and honest detail truncation. Standard sync/watch stay unchanged from origin/main; superseded wake.ts, sync-run.ts, and their tests are removed. Revised-head local gate is green: formatting/Flowmark, strict typecheck, zero-warning lint plus TS/JS lint-contract probes, build, 109 Vitest files / 1,507 tests, 1,074 tryscript checks, publint, 31 package-age pins, packed web proof (62,196-byte page), and watch release smoke. Performance: real 5,000-file list 1.03 s; 10,001 in-memory board load 20.77 ms, one-change refresh 20.24 ms, 10,000-row response 52.07 ms / 2.47 MiB. Commit/push, hosted CI, final PR comment audit, and mergeability audit remain.
