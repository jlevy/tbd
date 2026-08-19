---
type: is
id: is-01kzt77cb9bjsemwev2d6v9s8h
title: Keep lock acquisition portable without weakening ownership safety
kind: bug
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels: []
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T05:30:50.600Z
updated_at: 2026-08-12T06:08:38.583Z
closed_at: 2026-08-12T06:08:38.582Z
close_reason: Implemented the portable mkdir-elected owner-generation protocol, bounded all failed-progress paths, preserved actionable permission diagnostics, and verified the adversarial and full release matrices.
---
Final-head Bugbot found that hard-link owner installation is not available on every filesystem supported by mkdir/rename locking. Replace the hard-link requirement with a portable atomic protocol that installs a complete owner generation, cannot overwrite a successor, never enters the critical section ownerless, and recovers an abandoned pre-owner acquisition. Add adversarial portability/race regressions and update the design proof/file-function map.
