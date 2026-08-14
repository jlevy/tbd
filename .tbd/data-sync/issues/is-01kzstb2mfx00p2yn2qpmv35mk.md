---
type: is
id: is-01kzstb2mfx00p2yn2qpmv35mk
title: Fence late observer callbacks after shutdown begins
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
created_at: 2026-08-12T01:45:40.238Z
updated_at: 2026-08-12T04:38:51.067Z
closed_at: 2026-08-12T04:38:51.067Z
close_reason: Implemented and verified against the normative concurrency contract; focused adversarial coverage and the full release matrix pass.
---
LocalObserver.stop sets stopped and waits for active work, but handleNativeFailure and refresh continuations can still mutate or notify observer state after stop begins. Guard late watcher callbacks and re-check stopped after each awaited marker/reload boundary so teardown emits only the final stopped state and performs no unnecessary reload.
