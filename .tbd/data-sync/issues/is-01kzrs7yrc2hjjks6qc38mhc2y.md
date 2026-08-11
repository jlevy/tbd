---
type: is
id: is-01kzrs7yrc2hjjks6qc38mhc2y
title: "Phase 3.2: implement read-only HTTP router and resumable SSE hub"
kind: task
status: in_progress
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - server
  - security
  - web
dependencies:
  - type: blocks
    target: is-01kzrs8gb1ky34vpdv7qfdfv4q
parent_id: is-01kzrs66v8et3vwh2tpmk3v9d9
created_at: 2026-08-11T16:07:14.955Z
updated_at: 2026-08-11T16:29:39.043Z
extensions:
  linear:
    id: a3abf765-1007-4147-9f68-b11f8fa6b651
    linked_at: 2026-08-11T16:24:46.064Z
    key: TBD-140
    url: https://linear.app/finterm-ai/issue/TBD-140/phase-32-implement-read-only-http-router-and-resumable-sse-hub
---
Create packages/tbd/src/cli/web/http.ts. Implement GET /, /api/board, /api/bead, /api/events; exact Host/Origin validation; public-id validation; JSON/error helpers; no mutation route; SSE id=tip, Last-Event-ID resume handoff, bounded frames, heartbeat, writable/backpressure cap, client cleanup, and abort-aware close. Add router/security/SSE unit tests.

## Notes

BoardState and WakeCoordinator dependencies are green. Implementing the read-only router and resumable SSE hub next: Host/Origin validation, GET-only routes, public-id validation through BoardState, Last-Event-ID replay, bounded frames, heartbeat, and backpressure drop.
