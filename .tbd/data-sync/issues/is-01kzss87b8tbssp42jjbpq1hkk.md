---
type: is
id: is-01kzss87b8tbssp42jjbpq1hkk
title: Coalesce tbd web observer reloads under sustained filesystem bursts
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - concurrency
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T01:26:38.183Z
updated_at: 2026-08-12T04:38:51.006Z
closed_at: 2026-08-12T04:38:51.006Z
close_reason: Implemented and verified against the normative concurrency contract; focused adversarial coverage and the full release matrix pass.
---
LocalObserver.enqueueRefresh appends every fired native debounce and reconciliation request to a promise tail. When reload time exceeds the debounce interval, a sustained event stream can create an unbounded backlog of full graph scans. Replace it with a single-flight drain that permits at most one active and one coalesced pending refresh; preserve shutdown awaiting and final-state correctness; add adversarial deferred-reload tests.
