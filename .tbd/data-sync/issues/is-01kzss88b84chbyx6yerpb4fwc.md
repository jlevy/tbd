---
type: is
id: is-01kzss88b84chbyx6yerpb4fwc
title: Cancel superseded browser requests so stale work cannot starve live updates
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - concurrency
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T01:26:39.207Z
updated_at: 2026-08-12T04:38:51.039Z
closed_at: 2026-08-12T04:38:51.039Z
close_reason: Implemented and verified against the normative concurrency contract; focused adversarial coverage and the full release matrix pass.
---
The client serializes board refreshes and caps detail requests, but neither class of fetch is abortable. A hung stale board response blocks every newer SSE-driven refresh; eight hung pre-update detail requests block all current-generation detail work. Thread AbortSignal through Transport.fetchJson, abort obsolete board/body requests on state/query generation changes and stop, preserve concurrency accounting, and add deferred-request regressions.
