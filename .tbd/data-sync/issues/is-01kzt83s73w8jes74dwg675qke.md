---
type: is
id: is-01kzt83s73w8jes74dwg675qke
title: Avoid busy-loop when stale-generation quarantine is already occupied
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels: []
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T05:46:21.282Z
updated_at: 2026-08-12T06:08:38.607Z
closed_at: 2026-08-12T06:08:38.607Z
close_reason: Implemented the portable mkdir-elected owner-generation protocol, bounded all failed-progress paths, preserved actionable permission diagnostics, and verified the adversarial and full release matrices.
---
breakStaleLock currently returns no progress signal, so callers immediately retry even when the deterministic retained quarantine path is already occupied and the canonical dead generation did not move. Return whether the atomic rename succeeded; retry immediately only on progress, otherwise stay fail-closed on the normal poll cadence. Add an occupied-quarantine regression and map it in the design/spec.
