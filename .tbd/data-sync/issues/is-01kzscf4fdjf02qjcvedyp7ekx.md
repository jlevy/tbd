---
type: is
id: is-01kzscf4fdjf02qjcvedyp7ekx
title: Make tbd web a local-only live view
kind: feature
status: closed
priority: 1
version: 13
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
  - is-01kzsht4a5vje1r75mnxx475vd
  - is-01kzsjvx0n0zpjj9tdrxcj6m2p
  - is-01kzskxqpat6jdk9ge12wmhayp
created_at: 2026-08-11T21:43:13.132Z
updated_at: 2026-08-12T00:09:11.004Z
closed_at: 2026-08-12T00:09:11.003Z
close_reason: Local-only live-view contract implemented, documented, fully validated, and merge-ready on 2a7a7d44.
---
Remove all implicit remote polling and fetching from tbd web. Observe the hidden data-sync worktree through a native Node filesystem watcher with a one-second reconciliation fallback, so local tbd commands and tbd sync appear promptly. Remove the polling CLI flag and remote-watch/report state, align the UI and every design/user/validation document, test native/degraded/reconciliation behavior cross-platform, and re-run the PR merge gate.

## Notes

Owner contract delivered: tbd web is strictly local and read-only; only ordinary tbd sync exchanges remote state. Native fs.watch plus 250 ms trailing debounce provides immediate updates and a constant-size one-second marker reconciles missed events without unchanged-graph reloads. Standard sync/watch are unchanged; all web remote polling, flags, and helper code are gone. Board/client/SSE/lifecycle work is bounded at the 10,000-row server and 1,000-row render windows. Final local gate: 109 files / 1,508 tests, 1,074 tryscript checks, publint, 31 package-age pins, packed-web and watch-release proofs. Final head 2a7a7d44 passed hosted run 31548603423 across Ubuntu, macOS, Windows, coverage/lint, benchmark, Bugbot, and secret scan. Thread audit: 5 comments, 20 reviews, 12/12 resolved. PR is OPEN, non-draft, MERGEABLE, CLEAN.
