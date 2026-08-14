---
type: is
id: is-01kzysmb4s1ntzjgq5e7yhfpmr
title: Validate merged Linear integration and install tbd globally
kind: task
status: in_progress
priority: 1
version: 4
labels: []
dependencies: []
child_order_hints:
  - is-01kzyswrkqt9hp8s9tdke7860f
created_at: 2026-08-14T00:09:27.441Z
updated_at: 2026-08-14T00:14:04.455Z
---
Create a stabilization branch from merged main, review that Linear remains fully opt-in and no-Linear users retain existing behavior, run release and packaged-install validation, replace the global tbd installation from the validated local package, and report release readiness without publishing a public release unless explicitly requested.
