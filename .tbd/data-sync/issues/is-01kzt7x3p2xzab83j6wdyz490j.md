---
type: is
id: is-01kzt7x3p2xzab83j6wdyz490j
title: Avoid busy-loop on non-empty ownerless lock state
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels: []
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T05:42:42.625Z
updated_at: 2026-08-12T06:08:38.594Z
closed_at: 2026-08-12T06:08:38.594Z
close_reason: Implemented the portable mkdir-elected owner-generation protocol, bounded all failed-progress paths, preserved actionable permission diagnostics, and verified the adversarial and full release matrices.
---
While implementing portable mkdir owner installation, the stale ownerless recovery branch could immediately retry even when rmdir failed because the directory was non-empty or otherwise unrecoverable. Return cleanup progress explicitly, retry immediately only after removal, otherwise preserve fail-closed state on the normal polling cadence. Add a bounded-attempt regression and map it in the design/spec.
