---
type: is
id: is-01kzrs8gb1ky34vpdv7qfdfv4q
title: "Phase 3.4: implement loopback server lifecycle, ports, readiness, and shutdown"
kind: task
status: open
priority: 1
version: 2
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
updated_at: 2026-08-11T16:07:39.323Z
---
Create packages/tbd/src/cli/web/server.ts. Bind only 127.0.0.1; default bounded port search vs explicit pinned port; load the stitched page; readiness self-probe; compose BoardState/router/wake; expose {port,url,close,closed}; close SSE immediately, race server close against bounded timeout, unref timers, and make close idempotent. Test port contention/range exhaustion, listener address, readiness, and bounded close.
