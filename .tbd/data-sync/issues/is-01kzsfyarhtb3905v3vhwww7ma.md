---
type: is
id: is-01kzsfyarhtb3905v3vhwww7ma
title: Harden tbd web SSE writes against closed-stream races
kind: bug
status: closed
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - pr-207
  - review
dependencies: []
parent_id: is-01kzscf4fdjf02qjcvedyp7ekx
created_at: 2026-08-11T22:43:56.816Z
updated_at: 2026-08-11T22:45:30.167Z
closed_at: 2026-08-11T22:45:30.165Z
close_reason: SSE closed-stream races are isolated to the affected client and regression-tested; focused web tests and typecheck pass.
---
SseHub checks queued bytes before response.write(), but a client may close or the stream may finish between those operations. Catch synchronous write failures, check writable-ended state, drop only that client, and add a regression so a heartbeat or publish cannot escape into the process.

## Notes

Implemented in src/cli/web/http.ts: SseHub checks writableEnded, catches synchronous write races, drops only the affected response, and installs a response error listener. tests/web-http.test.ts covers both explicit queued-byte pressure and a write that closes between checks. Focused web suite: 5 files / 40 tests green; package typecheck green.
