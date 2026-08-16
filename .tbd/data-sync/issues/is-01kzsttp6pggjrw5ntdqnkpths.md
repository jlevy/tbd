---
type: is
id: is-01kzsttp6pggjrw5ntdqnkpths
title: Keep interrupted web startup out of long lock waits
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - concurrency
  - shutdown
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T01:54:11.795Z
updated_at: 2026-08-12T04:38:51.074Z
closed_at: 2026-08-12T04:38:51.074Z
close_reason: Implemented and verified against the normative concurrency contract; focused adversarial coverage and the full release matrix pass.
---
Repair-capable startup context preparation can wait on the shared data-sync lock, but WebHandler currently installs its custom bounded-shutdown signal handler first and then awaits startup. Prepare context before suspending the default interrupt behavior (or make the wait cancellable), pass the prepared context into server startup, and prove the live observer remains lock-free.
