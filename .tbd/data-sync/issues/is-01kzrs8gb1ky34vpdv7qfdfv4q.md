---
type: is
id: is-01kzrs8gb1ky34vpdv7qfdfv4q
title: "Phase 3.4: implement loopback server lifecycle, ports, readiness, and shutdown"
kind: task
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - server
  - lifecycle
  - web
dependencies:
  - type: blocks
    target: is-01kzrs8phwbdy9hdkxm6c6k8pe
parent_id: is-01kzrs66v8et3vwh2tpmk3v9d9
created_at: 2026-08-11T16:07:32.955Z
updated_at: 2026-08-11T16:40:17.360Z
closed_at: 2026-08-11T16:40:17.359Z
close_reason: "Implemented src/cli/web/server.ts: packaged-page loading, loopback-only bind, pinned/default-range port policy, HTTP readiness probe, request/socket limits, Wake/Board/SSE lifecycle, bounded idempotent shutdown, and browser-launch fallback seam. Port/lifecycle tests green."
extensions:
  linear:
    id: 8980c965-5f00-4dc2-b17c-0d703a2a3b0a
    linked_at: 2026-08-11T16:24:48.972Z
    key: TBD-142
    url: https://linear.app/finterm-ai/issue/TBD-142/phase-34-implement-loopback-server-lifecycle-ports-readiness-and
---
Create packages/tbd/src/cli/web/server.ts. Bind only 127.0.0.1; default bounded port search vs explicit pinned port; load the stitched page; readiness self-probe; compose BoardState/router/wake; expose {port,url,close,closed}; close SSE immediately, race server close against bounded timeout, unref timers, and make close idempotent. Test port contention/range exhaustion, listener address, readiness, and bounded close.
