---
type: is
id: is-01kzsynkh82v55b35pw3gw3dc7
title: Cap aggregate SSE clients and fan-out work
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - concurrency
  - resource-bounds
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T03:01:19.527Z
updated_at: 2026-08-12T04:38:51.129Z
closed_at: 2026-08-12T04:38:51.129Z
close_reason: Implemented and verified against the normative concurrency contract; focused adversarial coverage and the full release matrix pass.
---
SseHub bounds history and bytes per client but leaves the client set unbounded. Repeated loopback connections can therefore grow aggregate socket buffers and make every observer publication O(unbounded clients), contradicting the design's bounded-contention claim. Add a conservative production client cap, reject excess attaches before streaming, and prove a rejected client is neither retained nor written during later publication.
